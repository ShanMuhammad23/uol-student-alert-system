type SmtpMailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
};

export async function sendSmtpMail(input: SmtpMailInput): Promise<void> {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const secureRaw = process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromAddress = process.env.SMTP_FROM ?? "alert@student-alert.uol.edu.pk";

  if (!host || !portRaw || !user || !pass) {
    throw new Error("SMTP configuration is incomplete.");
  }

  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port: Number(portRaw),
    secure: String(secureRaw).toLowerCase() === "true",
    auth: { user, pass },
  });

  const cc =
    input.cc?.map((e) => e.trim()).filter(Boolean) ?? [];

  await transport.sendMail({
    from: fromAddress,
    to: input.to,
    ...(cc.length ? { cc } : {}),
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
  });
}
