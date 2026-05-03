import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Real-database test: proves storage.deleteUser actually rolls back the
// cascade in Postgres when a delete inside the transaction fails. We spy on
// db.transaction to intercept the supplied tx and replace its final
// `tx.delete(users)` call with one that rejects. The outer transaction
// then ROLLBACKs, and we assert the previously-deleted vehicles row is
// still present in the database.
const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("storage.deleteUser (real DB rollback)", () => {
  let db: typeof import("../server/db").db;
  let storage: typeof import("../server/storage").storage;
  let users: typeof import("@shared/schema").users;
  let vehicles: typeof import("@shared/schema").vehicles;
  const created: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("../server/db"));
    ({ storage } = await import("../server/storage"));
    const schema = await import("@shared/schema");
    users = schema.users;
    vehicles = schema.vehicles;
  });

  afterAll(async () => {
    for (const id of created) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function makeUserWithVehicle(): Promise<{ userId: string; vehicleId: string }> {
    const username = `txtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash("not-a-real-password", 4);
    const [u] = await db
      .insert(users)
      .values({ username, passwordHash, role: "user" })
      .returning();
    created.push(u.id);
    const [v] = await db
      .insert(vehicles)
      .values({ userId: u.id, year: 2020, make: "Test", model: "Car" })
      .returning();
    return { userId: u.id, vehicleId: v.id };
  }

  it("commits the cascade on the happy path", async () => {
    const { userId } = await makeUserWithVehicle();

    await storage.deleteUser(userId);

    const remainingUsers = await db.select().from(users).where(eq(users.id, userId));
    const remainingVehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId));
    expect(remainingUsers).toHaveLength(0);
    expect(remainingVehicles).toHaveLength(0);
  });

  it("Postgres ROLLBACKs the cascade when a mid-transaction delete fails", async () => {
    const { userId, vehicleId } = await makeUserWithVehicle();

    const originalTransaction = db.transaction.bind(db);
    const spy = vi
      .spyOn(db, "transaction")
      .mockImplementation((cb: Parameters<typeof db.transaction>[0]) => {
        return originalTransaction(async (tx) => {
          const originalTxDelete = tx.delete.bind(tx);
          // Wrap tx.delete: when the implementation attempts the final
          // delete on the users table, force it to reject. Every prior
          // delete in this transaction (vehicles, garage members, …) must
          // then be rolled back by Postgres.
          (tx as unknown as { delete: typeof tx.delete }).delete = ((table: unknown) => {
            if (table === users) {
              return {
                where: () => Promise.reject(new Error("simulated mid-cascade failure")),
              } as unknown as ReturnType<typeof tx.delete>;
            }
            return originalTxDelete(table as Parameters<typeof tx.delete>[0]);
          }) as typeof tx.delete;
          return cb(tx);
        });
      });

    try {
      await expect(storage.deleteUser(userId)).rejects.toThrow(/simulated mid-cascade/);
    } finally {
      spy.mockRestore();
    }

    const remainingUsers = await db.select().from(users).where(eq(users.id, userId));
    const remainingVehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId));
    // Both rows must still exist — proving the cascade was wrapped in a
    // transaction that Postgres successfully rolled back.
    expect(remainingUsers).toHaveLength(1);
    expect(remainingVehicles).toHaveLength(1);
  });
});
