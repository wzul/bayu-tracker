import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "noreply@bayu.local";

function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured — emails will be logged but not sent");
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = createTransport();

  if (!transport) {
    console.log("[email] Would send to", options.to, ":", options.subject);
    return true;
  }

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}
