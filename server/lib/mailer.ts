type EmailProvider = "resend" | "postmark" | "log";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: EmailProvider;
  id?: string;
  error?: string;
}

function detectProvider(): EmailProvider {
  const requested = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return "log";
  if (requested === "resend" || requested === "postmark") return requested as EmailProvider;
  // EMAIL_API_KEY is set but EMAIL_PROVIDER is missing/unrecognized. In production
  // this is almost certainly a misconfiguration — fail loudly instead of silently
  // logging emails to stdout. In dev we surface a warning and keep the dev fallback
  // so local work isn't blocked.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `EMAIL_API_KEY is set but EMAIL_PROVIDER is "${requested || "(unset)"}". Set EMAIL_PROVIDER to "resend" or "postmark".`,
    );
  }
  console.warn(
    `[mailer] EMAIL_API_KEY is set but EMAIL_PROVIDER is "${requested || "(unset)"}". Falling back to console logging in development. Set EMAIL_PROVIDER to "resend" or "postmark".`,
  );
  return "log";
}

function getFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.MAIL_FROM ||
    "TorqueShed <no-reply@torqueshed.pro>"
  );
}

async function sendViaResend(input: SendEmailInput, apiKey: string): Promise<SendEmailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: getFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { ok: false, provider: "resend", error: `Resend error ${res.status}: ${errText}` };
  }
  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, provider: "resend", id: body?.id };
}

async function sendViaPostmark(input: SendEmailInput, apiKey: string): Promise<SendEmailResult> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": apiKey,
    },
    body: JSON.stringify({
      From: getFrom(),
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      TextBody: input.text,
      MessageStream: process.env.POSTMARK_STREAM || "outbound",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { ok: false, provider: "postmark", error: `Postmark error ${res.status}: ${errText}` };
  }
  const body = (await res.json().catch(() => null)) as { MessageID?: string } | null;
  return { ok: true, provider: "postmark", id: body?.MessageID };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = detectProvider();
  const apiKey = process.env.EMAIL_API_KEY;

  if (provider === "log" || !apiKey) {
    console.log("[mailer:log] No EMAIL_PROVIDER+EMAIL_API_KEY configured — printing email instead.");
    console.log(`[mailer:log] To: ${input.to}`);
    console.log(`[mailer:log] Subject: ${input.subject}`);
    console.log(`[mailer:log] Body:\n${input.text || input.html}`);
    return { ok: true, provider: "log" };
  }

  try {
    if (provider === "resend") return await sendViaResend(input, apiKey);
    if (provider === "postmark") return await sendViaPostmark(input, apiKey);
    return { ok: false, provider: "log", error: `Unsupported provider ${provider}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, provider, error: message };
  }
}

export function buildVerificationEmail(verifyUrl: string, email: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Verify your TorqueShed email";
  const text = [
    "Welcome to TorqueShed.",
    "",
    `Confirm ${email} as the address for your account by opening the link below:`,
    verifyUrl,
    "",
    "This link expires in 24 hours. If you did not request this, you can ignore this message.",
    "",
    "— The TorqueShed crew",
  ].join("\n");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#0D0F12;color:#E5E7EB;font-family:Inter,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#111318;border:1px solid #1F2937;border-radius:16px;padding:32px;">
    <h1 style="font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:22px;color:#FFFFFF;margin:0 0 16px;letter-spacing:-0.3px;">Verify your email</h1>
    <p style="font-size:15px;line-height:1.6;color:#9CA3AF;margin:0 0 24px;">
      Confirm <strong style="color:#FFFFFF;">${email}</strong> as the address tied to your TorqueShed account.
    </p>
    <p style="margin:0 0 28px;">
      <a href="${verifyUrl}" style="display:inline-block;background:#FF6B35;color:#FFFFFF;text-decoration:none;font-weight:700;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:15px;padding:14px 28px;border-radius:10px;">Verify email</a>
    </p>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:0 0 8px;">Or paste this link into your browser:</p>
    <p style="font-size:13px;color:#9CA3AF;word-break:break-all;margin:0 0 24px;">${verifyUrl}</p>
    <p style="font-size:12px;color:#6B7280;margin:0;">This link expires in 24 hours. If you did not request this, you can safely ignore this message.</p>
  </div>
</body></html>`;
  return { subject, html, text };
}
