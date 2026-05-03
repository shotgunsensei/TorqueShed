import { db } from "./db";
import { users, shopTeamMembers } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const valid = messages.filter((m) => typeof m.to === "string" && m.to.startsWith("ExponentPushToken"));
  if (valid.length === 0) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(valid),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[notifications] Expo push request failed", res.status, text);
      return;
    }
    const json = await res.json().catch(() => null);
    if (json && Array.isArray(json.data)) {
      for (let i = 0; i < json.data.length; i++) {
        const ticket = json.data[i];
        if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
          const token = valid[i]?.to;
          if (token) {
            await db.update(users).set({ expoPushToken: null }).where(eq(users.expoPushToken, token));
            console.log("[notifications] Cleared invalid push token");
          }
        }
      }
    }
  } catch (err) {
    console.warn("[notifications] Failed to send push", err);
  }
}

export async function notifyOwnerAndTeamOfNewLead(params: {
  ownerUserId: string;
  customerName: string;
  issue: string;
  vehicle?: string | null;
  leadId: string;
}): Promise<void> {
  try {
    const teamRows = await db
      .select({ memberUserId: shopTeamMembers.memberUserId })
      .from(shopTeamMembers)
      .where(eq(shopTeamMembers.ownerUserId, params.ownerUserId));

    const recipientIds = Array.from(
      new Set([params.ownerUserId, ...teamRows.map((r) => r.memberUserId)]),
    );

    const recipients = await db
      .select({
        id: users.id,
        expoPushToken: users.expoPushToken,
        notificationsEnabled: users.notificationsEnabled,
      })
      .from(users)
      .where(inArray(users.id, recipientIds));

    const title = "New customer lead";
    const bodyVehicle = params.vehicle ? ` (${params.vehicle})` : "";
    const issueShort = params.issue.length > 100 ? `${params.issue.slice(0, 97)}...` : params.issue;
    const body = `${params.customerName}${bodyVehicle}: ${issueShort}`;

    const messages: ExpoPushMessage[] = [];
    for (const r of recipients) {
      if (r.notificationsEnabled === false) continue;
      if (!r.expoPushToken) continue;
      messages.push({
        to: r.expoPushToken,
        title,
        body,
        sound: "default",
        data: { type: "shop_lead", leadId: params.leadId },
      });
    }

    await sendExpoPushNotifications(messages);
  } catch (err) {
    console.warn("[notifications] notifyOwnerAndTeamOfNewLead failed", err);
  }
}
