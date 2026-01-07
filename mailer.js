// backend/mailer.js
import nodemailer from "nodemailer";
import { safeStr } from "./src/utils.js";

function hasSmtp() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMail({ to, subject, text, html }) {
  if (!hasSmtp()) {
    // no rompe en producción si no has configurado SMTP
    console.log("ℹ️ SMTP no configurado. Email NO enviado:", { to, subject });
    return { ok: false, skipped: true };
  }

  const transporter = getTransport();
  const from = safeStr(process.env.MAIL_FROM || process.env.SMTP_USER);

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { ok: true, messageId: info.messageId };
}

export async function sendResetEmail({ to, resetLink }) {
  const subject = "Recuperación de contraseña — En2x3";
  const text = `Hola,\n\nPara restablecer tu contraseña abre este enlace:\n${resetLink}\n\nSi no fuiste tú, ignora este mensaje.`;
  const html = `<p>Hola,</p><p>Para restablecer tu contraseña abre este enlace:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Si no fuiste tú, ignora este mensaje.</p>`;
  return sendMail({ to, subject, text, html });
}
