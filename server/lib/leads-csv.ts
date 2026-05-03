import type { ShopLead } from "@shared/schema";

const FORMULA_TRIGGER = /^[=+\-@\t\r\n]/;

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (FORMULA_TRIGGER.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const SHOP_LEADS_CSV_HEADER = [
  "created_at",
  "name",
  "email",
  "phone",
  "vehicle",
  "issue",
  "preferred_contact",
  "read",
];

export function shopLeadToCsvRow(l: ShopLead): string[] {
  return [
    l.createdAt ? new Date(l.createdAt).toISOString() : "",
    l.customerName,
    l.email ?? "",
    l.phone ?? "",
    l.vehicle ?? "",
    l.issue,
    l.preferredContact ?? "",
    l.isRead ? "yes" : "no",
  ];
}

export function buildShopLeadsCsv(leads: ShopLead[]): string {
  const lines: string[] = [];
  lines.push(SHOP_LEADS_CSV_HEADER.join(","));
  for (const l of leads) {
    lines.push(shopLeadToCsvRow(l).map(escapeCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function writeShopLeadsCsvToStream(
  leads: ShopLead[],
  write: (chunk: string) => void,
): void {
  write(SHOP_LEADS_CSV_HEADER.join(",") + "\r\n");
  for (const l of leads) {
    write(shopLeadToCsvRow(l).map(escapeCell).join(",") + "\r\n");
  }
}
