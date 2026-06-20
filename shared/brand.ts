export const APP_BRAND = {
  name: "TorqueShed",
  shortName: "TorqueShed",
  tagline: "Diagnose smarter. Track repairs. Confirm the fix.",
  legalName: "TorqueShed, LLC",
  primaryDomain: "torqueshed.pro",
  appPath: "/app",
  supportEmail: "support@torqueshed.pro",
  noReplyEmail: "no-reply@torqueshed.pro",
  remindersEmail: "reminders@torqueshed.pro",
} as const;

export const APP_URLS = {
  production: `https://${APP_BRAND.primaryDomain}`,
  app: `https://${APP_BRAND.primaryDomain}${APP_BRAND.appPath}`,
  supportMailto: `mailto:${APP_BRAND.supportEmail}`,
} as const;
