import { db } from "./db";
import { storage } from "./storage";
import { users, subscriptions, maintenanceReminders, type MaintenanceReminder } from "@shared/schema";
import { APP_BRAND } from "@shared/brand";
import { and, eq, inArray, sql } from "drizzle-orm";

const ACCESS_GRANTING_STATUSES = ["active", "trialing", "past_due"];
const TIERS_WITH_REMINDERS = ["garage_pro", "shop_pro"];

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ReminderItem {
  noteId: string;
  vehicleId: string;
  vehicleName: string;
  title: string;
  type: string;
  daysRemaining: number | null;
  milesRemaining: number | null;
  isOverdue: boolean;
}

interface DeliveryResult {
  channel: "push" | "email" | "none";
  ok: boolean;
  reason?: string;
}

function reasonKey(item: ReminderItem): string {
  if (item.isOverdue) return "overdue";
  if (item.daysRemaining !== null && item.daysRemaining <= 7) return "due_7d";
  if (item.milesRemaining !== null && item.milesRemaining <= 250) return "due_250mi";
  return "due_soon";
}

function buildSubject(item: ReminderItem): string {
  if (item.isOverdue) return `Overdue: ${item.title} on ${item.vehicleName}`;
  return `Maintenance due soon: ${item.title} on ${item.vehicleName}`;
}

function buildBody(item: ReminderItem): string {
  const parts: string[] = [];
  if (item.daysRemaining !== null) {
    parts.push(
      item.daysRemaining < 0
        ? `${Math.abs(item.daysRemaining)} days overdue`
        : `due in ${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"}`,
    );
  }
  if (item.milesRemaining !== null) {
    parts.push(
      item.milesRemaining < 0
        ? `${Math.abs(item.milesRemaining).toLocaleString()} mi overdue`
        : `${item.milesRemaining.toLocaleString()} mi remaining`,
    );
  }
  const detail = parts.length ? ` (${parts.join(" · ")})` : "";
  return `${item.title} on ${item.vehicleName}${detail}.`;
}

async function sendExpoPush(token: string, item: ReminderItem): Promise<DeliveryResult> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title: buildSubject(item),
        body: buildBody(item),
        data: { noteId: item.noteId, vehicleId: item.vehicleId, kind: "maintenance_reminder" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { channel: "push", ok: false, reason: `expo http ${res.status}: ${text.slice(0, 120)}` };
    }
    const json = (await res.json()) as { data?: { status?: string; message?: string } };
    if (json.data?.status === "error") {
      return { channel: "push", ok: false, reason: json.data.message ?? "expo error" };
    }
    return { channel: "push", ok: true };
  } catch (err) {
    return { channel: "push", ok: false, reason: err instanceof Error ? err.message : "push failed" };
  }
}

async function sendEmail(to: string, item: ReminderItem): Promise<DeliveryResult> {
  const subject = buildSubject(item);
  const text = buildBody(item) + "\n\nOpen TorqueShed to log the service or update the next-due interval.";

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REMINDER_FROM_EMAIL || `${APP_BRAND.name} <${APP_BRAND.remindersEmail}>`;

  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({ from: fromAddress, to, subject, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { channel: "email", ok: false, reason: `resend ${res.status}: ${body.slice(0, 120)}` };
      }
      return { channel: "email", ok: true };
    } catch (err) {
      return { channel: "email", ok: false, reason: err instanceof Error ? err.message : "email failed" };
    }
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    try {
      const fromMatch = /<([^>]+)>/.exec(fromAddress);
      const fromEmail = fromMatch ? fromMatch[1] : fromAddress;
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendgridKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }], subject }],
          from: { email: fromEmail },
          content: [{ type: "text/plain", value: text }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { channel: "email", ok: false, reason: `sendgrid ${res.status}: ${body.slice(0, 120)}` };
      }
      return { channel: "email", ok: true };
    } catch (err) {
      return { channel: "email", ok: false, reason: err instanceof Error ? err.message : "email failed" };
    }
  }

  console.log(
    `[reminders] (no email provider configured) would email ${to}: ${subject} — ${text}`,
  );
  return { channel: "email", ok: false, reason: "no email provider" };
}

interface RunStats {
  usersChecked: number;
  itemsConsidered: number;
  remindersSent: number;
  remindersSkipped: number;
  failures: number;
}

export async function runMaintenanceRemindersOnce(): Promise<RunStats> {
  const stats: RunStats = {
    usersChecked: 0,
    itemsConsidered: 0,
    remindersSent: 0,
    remindersSkipped: 0,
    failures: 0,
  };

  // Find active Garage Pro / Shop Pro users
  const activeRows = await db
    .select({
      userId: subscriptions.userId,
      tier: subscriptions.tier,
      status: subscriptions.status,
      email: users.email,
      pushToken: users.expoPushToken,
      notificationsEnabled: users.notificationsEnabled,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.tier, TIERS_WITH_REMINDERS),
        inArray(subscriptions.status, ACCESS_GRANTING_STATUSES),
      ),
    );

  for (const row of activeRows) {
    stats.usersChecked += 1;
    if (row.notificationsEnabled === false) continue;
    if (!row.pushToken && !row.email) continue;

    let items: ReminderItem[];
    try {
      items = (await storage.getMaintenanceDueForUser(row.userId)) as unknown as ReminderItem[];
    } catch (err) {
      console.error(`[reminders] failed loading items for user ${row.userId}:`, err);
      stats.failures += 1;
      continue;
    }
    if (items.length === 0) continue;

    const noteIds = items.map((i) => i.noteId);
    const alreadySent = await db
      .select({ noteId: maintenanceReminders.noteId })
      .from(maintenanceReminders)
      .where(
        and(
          eq(maintenanceReminders.userId, row.userId),
          inArray(maintenanceReminders.noteId, noteIds),
        ),
      );
    const sentNotes = new Set(alreadySent.map((r) => r.noteId));

    for (const item of items) {
      stats.itemsConsidered += 1;
      // Dedup: one reminder per (user, item). Once sent, never re-send for the
      // same item — even if it escalates from due_soon to overdue. The user can
      // see the current state in-app via the maintenance widget.
      if (sentNotes.has(item.noteId)) {
        stats.remindersSkipped += 1;
        continue;
      }

      let result: DeliveryResult = { channel: "none", ok: false };
      if (row.pushToken) {
        result = await sendExpoPush(row.pushToken, item);
      }
      if (!result.ok && row.email) {
        result = await sendEmail(row.email, item);
      }

      if (result.ok) {
        stats.remindersSent += 1;
        try {
          // ON CONFLICT DO NOTHING enforces (userId, noteId) uniqueness at DB
          // level, so concurrent runs cannot double-send.
          await db
            .insert(maintenanceReminders)
            .values({
              userId: row.userId,
              noteId: item.noteId,
              channel: result.channel,
              reason: reasonKey(item),
            })
            .onConflictDoNothing({
              target: [maintenanceReminders.userId, maintenanceReminders.noteId],
            });
          sentNotes.add(item.noteId);
        } catch (err) {
          console.error("[reminders] failed recording reminder:", err);
        }
      } else {
        stats.failures += 1;
        console.warn(
          `[reminders] failed for user ${row.userId} note ${item.noteId}: ${result.reason ?? "unknown"}`,
        );
      }
    }
  }

  return stats;
}

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startMaintenanceReminderScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (process.env.MAINTENANCE_REMINDERS_DISABLED === "1") {
    console.log("[reminders] scheduler disabled via env");
    return;
  }

  const intervalHours = Number(process.env.MAINTENANCE_REMINDERS_INTERVAL_HOURS || "24");
  const intervalMs = Math.max(1, intervalHours) * 3600 * 1000;
  const initialDelayMs = Number(process.env.MAINTENANCE_REMINDERS_INITIAL_DELAY_MS || "60000");

  console.log(
    `[reminders] scheduler enabled (initial ${Math.round(initialDelayMs / 1000)}s, then every ${intervalHours}h)`,
  );

  const tick = async () => {
    try {
      const stats = await runMaintenanceRemindersOnce();
      console.log(
        `[reminders] run complete users=${stats.usersChecked} items=${stats.itemsConsidered} sent=${stats.remindersSent} skipped=${stats.remindersSkipped} failures=${stats.failures}`,
      );
    } catch (err) {
      console.error("[reminders] run failed:", err);
    }
  };

  setTimeout(() => {
    void tick();
    intervalHandle = setInterval(() => void tick(), intervalMs);
  }, Math.max(0, initialDelayMs));
}

export function stopMaintenanceReminderScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  schedulerStarted = false;
}
