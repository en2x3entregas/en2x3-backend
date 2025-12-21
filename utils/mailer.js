import nodemailer from "nodemailer";

function boolEnv(v) {
  return String(v || "").toLowerCase() === "true";
}

export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = boolEnv(process.env.SMTP_SECURE) || port === 465;

  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Faltan variables SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendResetEmail({ to, nombre, resetLink }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();

  const subject = "Recuperación de contraseña — En2x3 Entregas";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Hola ${String(nombre || "").trim() || ""}</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>
        <a href="${resetLink}" target="_blank" rel="noreferrer">Haz clic aquí para crear una nueva contraseña</a>
      </p>
      <p>Este enlace expira en 30 minutos.</p>
      <p>Si no fuiste tú, ignora este mensaje.</p>
      <hr />
      <small>En2x3 Entregas</small>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}


