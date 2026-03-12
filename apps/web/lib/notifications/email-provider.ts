import { getServerEnv } from "@/lib/env";

export type SendTransactionalEmailInput = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string | null;
  replyTo?: string | null;
};

export type SendTransactionalEmailResult = {
  ok: boolean;
  provider: "resend";
  error: string | null;
};

async function sendWithResend(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const env = getServerEnv();
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, provider: "resend", error: "RESEND_API_KEY is not configured." };
  }

  const payload: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text
  };
  if (input.html?.trim()) {
    payload.html = input.html.trim();
  }
  if (input.replyTo?.trim()) {
    payload.reply_to = input.replyTo.trim();
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "resend",
      error: `Resend send failed (${response.status}): ${responseText || "Unknown error"}`
    };
  }

  return { ok: true, provider: "resend", error: null };
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const env = getServerEnv();
  const provider = env.MYRIVO_EMAIL_PROVIDER ?? "resend";

  if (provider === "resend") {
    return sendWithResend(input);
  }

  return { ok: false, provider: "resend", error: `Unsupported email provider: ${provider}` };
}
