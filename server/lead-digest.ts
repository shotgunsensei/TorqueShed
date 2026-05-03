import { db } from "./db";
import { storage } from "./storage";
import { users, subscriptions, leadDigests, shopLeads } from "@shared/schema";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { buildShopLeadsCsv } from "./lib/leads-csv";
import { sendEmail } from "./lib/mailer";

// Past-due intentionally excluded: matches the in-app CSV export, which blocks
// delinquent owners with HTTP 402.
const ACCESS_GRANTING_STATUSES = ["active", "trialing"];
const TIERS_WITH_DIGEST = ["shop_pro"];

interface RunStats {
  ownersChecked: number;
  digestsSent: number;
  digestsSkipped: number;
  failures: number;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDigestEmail(
  ownerName: string,
  digestDateLabel: string,
  leadCount: number,
  previewRows: { name: string; vehicle: string; issue: string; contact: string }[],
): { subject: string; html: string; text: string } {
  const subject = `Daily lead digest: ${leadCount} new lead${leadCount === 1 ? "" : "s"} (${digestDateLabel})`;
  const previewText = previewRows
    .map(
      (r, i) =>
        `${i + 1}. ${r.name}${r.vehicle ? ` — ${r.vehicle}` : ""}${r.contact ? ` — ${r.contact}` : ""}\n   ${r.issue}`,
    )
    .join("\n\n");
  const text = [
    `Hi ${ownerName || "there"},`,
    "",
    `You captured ${leadCount} lead${leadCount === 1 ? "" : "s"} on ${digestDateLabel}. The full list is attached as a CSV you can hand to the front desk.`,
    "",
    previewText || "(No preview available.)",
    "",
    "Manage this digest from Notification Settings inside TorqueShed.",
    "",
    "— TorqueShed",
  ].join("\n");
  const previewHtml = previewRows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #1F2937;color:#FFFFFF;">${escapeHtml(r.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #1F2937;color:#9CA3AF;">${escapeHtml(r.vehicle)}</td>
          <td style="padding:8px;border-bottom:1px solid #1F2937;color:#9CA3AF;">${escapeHtml(r.contact)}</td>
        </tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#0D0F12;color:#E5E7EB;font-family:Inter,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#111318;border:1px solid #1F2937;border-radius:16px;padding:32px;">
    <h1 style="font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:22px;color:#FFFFFF;margin:0 0 8px;letter-spacing:-0.3px;">Your daily lead list</h1>
    <p style="font-size:14px;color:#9CA3AF;margin:0 0 24px;">${escapeHtml(digestDateLabel)} · ${leadCount} new lead${leadCount === 1 ? "" : "s"}</p>
    <p style="font-size:15px;line-height:1.6;color:#E5E7EB;margin:0 0 20px;">The full list is attached as a CSV ready for the front desk to run the call list.</p>
    ${previewRows.length > 0 ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;"><thead><tr><th style="text-align:left;padding:8px;color:#9CA3AF;border-bottom:1px solid #1F2937;">Name</th><th style="text-align:left;padding:8px;color:#9CA3AF;border-bottom:1px solid #1F2937;">Vehicle</th><th style="text-align:left;padding:8px;color:#9CA3AF;border-bottom:1px solid #1F2937;">Contact</th></tr></thead><tbody>${previewHtml}</tbody></table>` : ""}
    <p style="font-size:12px;color:#6B7280;margin:0;">You can turn this digest off from Notification Settings inside TorqueShed.</p>
  </div>
</body></html>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function runLeadDigestOnce(now: Date = new Date()): Promise<RunStats> {
  const stats: RunStats = {
    ownersChecked: 0,
    digestsSent: 0,
    digestsSkipped: 0,
    failures: 0,
  };

  const todayStart = startOfUtcDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const digestDate = isoDate(yesterdayStart);
  const digestDateLabel = yesterdayStart.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const rows = await db
    .select({
      userId: subscriptions.userId,
      tier: subscriptions.tier,
      status: subscriptions.status,
      email: users.email,
      username: users.username,
      notificationsEnabled: users.notificationsEnabled,
      digestEnabled: users.dailyLeadDigestEnabled,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.tier, TIERS_WITH_DIGEST),
        inArray(subscriptions.status, ACCESS_GRANTING_STATUSES),
      ),
    );

  for (const row of rows) {
    stats.ownersChecked += 1;
    if (row.notificationsEnabled === false) continue;
    if (row.digestEnabled !== true) continue;
    if (!row.email) continue;

    // Dedup: one digest per (user, date). ON CONFLICT DO NOTHING enforces this
    // at the DB level so concurrent runs cannot double-send.
    const existing = await db
      .select({ id: leadDigests.id })
      .from(leadDigests)
      .where(and(eq(leadDigests.userId, row.userId), eq(leadDigests.digestDate, digestDate)))
      .limit(1);
    if (existing.length > 0) {
      stats.digestsSkipped += 1;
      continue;
    }

    let leads;
    try {
      leads = await db
        .select()
        .from(shopLeads)
        .where(
          and(
            eq(shopLeads.ownerUserId, row.userId),
            gte(shopLeads.createdAt, yesterdayStart),
            lt(shopLeads.createdAt, todayStart),
          ),
        );
    } catch (err) {
      console.error(`[lead-digest] failed loading leads for user ${row.userId}:`, err);
      stats.failures += 1;
      continue;
    }

    if (leads.length === 0) {
      // Nothing to send today; record so we don't repeatedly query for the same
      // empty day if the runner ticks more than once.
      try {
        await db
          .insert(leadDigests)
          .values({ userId: row.userId, digestDate, leadsCount: 0 })
          .onConflictDoNothing({ target: [leadDigests.userId, leadDigests.digestDate] });
      } catch (err) {
        console.error("[lead-digest] failed recording empty digest:", err);
      }
      stats.digestsSkipped += 1;
      continue;
    }

    const csv = buildShopLeadsCsv(leads);
    const previewRows = leads.slice(0, 5).map((l) => ({
      name: l.customerName,
      vehicle: l.vehicle ?? "",
      issue: l.issue,
      contact: l.email || l.phone || "",
    }));
    const { subject, html, text } = buildDigestEmail(
      row.username,
      digestDateLabel,
      leads.length,
      previewRows,
    );

    const result = await sendEmail({
      to: row.email,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `shop-leads-${digestDate}.csv`,
          content: csv,
          contentType: "text/csv; charset=utf-8",
        },
      ],
    });

    if (!result.ok) {
      stats.failures += 1;
      console.warn(
        `[lead-digest] failed for user ${row.userId} (${row.email}): ${result.error ?? "unknown"}`,
      );
      continue;
    }

    stats.digestsSent += 1;
    try {
      await db
        .insert(leadDigests)
        .values({ userId: row.userId, digestDate, leadsCount: leads.length })
        .onConflictDoNothing({ target: [leadDigests.userId, leadDigests.digestDate] });
    } catch (err) {
      console.error("[lead-digest] failed recording digest:", err);
    }
  }

  return stats;
}

let schedulerStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function startLeadDigestScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (process.env.LEAD_DIGEST_DISABLED === "1") {
    console.log("[lead-digest] scheduler disabled via env");
    return;
  }

  const intervalHours = Number(process.env.LEAD_DIGEST_INTERVAL_HOURS || "24");
  const intervalMs = Math.max(1, intervalHours) * 3600 * 1000;
  const initialDelayMs = Number(process.env.LEAD_DIGEST_INITIAL_DELAY_MS || "90000");

  console.log(
    `[lead-digest] scheduler enabled (initial ${Math.round(initialDelayMs / 1000)}s, then every ${intervalHours}h)`,
  );

  const tick = async () => {
    try {
      const stats = await runLeadDigestOnce();
      console.log(
        `[lead-digest] run complete owners=${stats.ownersChecked} sent=${stats.digestsSent} skipped=${stats.digestsSkipped} failures=${stats.failures}`,
      );
    } catch (err) {
      console.error("[lead-digest] run failed:", err);
    }
  };

  setTimeout(() => {
    void tick();
    intervalHandle = setInterval(() => void tick(), intervalMs);
  }, Math.max(0, initialDelayMs));
}

export function stopLeadDigestScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  schedulerStarted = false;
}
