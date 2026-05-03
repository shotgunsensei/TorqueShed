import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the db module BEFORE importing storage so the storage module picks up
// the stubbed db. The storage module calls db.transaction(cb) and the cb is
// expected to receive a `tx` with .select() and .delete() methods.

const transactionMock = vi.fn();

const buildTx = (failOnDeleteCallNumber: number | null = null) => {
  let deleteCalls = 0;
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => Promise.resolve([]), // no vehicles for this user
      }),
    })),
    delete: vi.fn(() => ({
      where: () => {
        deleteCalls += 1;
        if (failOnDeleteCallNumber !== null && deleteCalls === failOnDeleteCallNumber) {
          return Promise.reject(new Error("simulated mid-transaction failure"));
        }
        return Promise.resolve();
      },
    })),
  };
};

vi.mock("../server/db", () => ({
  db: {
    transaction: (cb: (tx: unknown) => Promise<unknown>) => transactionMock(cb),
  },
  pool: {},
}));

// Import after the mock is registered.
import { storage } from "../server/storage";

describe("storage.deleteUser", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("runs all cascade deletes inside a single db.transaction", async () => {
    const tx = buildTx();
    transactionMock.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => {
      return cb(tx);
    });

    await storage.deleteUser("user-1");

    expect(transactionMock).toHaveBeenCalledTimes(1);
    // 4 deletes: vehicles, garageMembers, reports, users
    // (vehicleNotes loop runs zero times since the select returns no vehicles)
    expect(tx.delete).toHaveBeenCalledTimes(4);
    expect(tx.select).toHaveBeenCalledTimes(1);
  });

  it("propagates errors so the transaction rolls back when a delete fails", async () => {
    const tx = buildTx(2); // make the second delete reject
    transactionMock.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => {
      // Mimic Drizzle: if cb throws, transaction rejects (and would ROLLBACK).
      return cb(tx);
    });

    await expect(storage.deleteUser("user-2")).rejects.toThrow(/simulated mid-transaction/);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
