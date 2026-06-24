/**
 * Verifica la configuración SMTP (usuario + clave de aplicación).
 * Uso:
 *   node src/scripts/testEmail.js            -> solo verifica la conexión
 *   node src/scripts/testEmail.js enviar     -> además envía un correo de prueba a MAIL_TO
 */
import nodemailer from 'nodemailer';
import { config } from '../config.js';

async function main() {
  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });

  console.log(`Verificando ${config.mail.host}:${config.mail.port} como ${config.mail.user}...`);
  await transporter.verify();
  console.log('OK: la conexión SMTP y las credenciales son válidas.');

  if (process.argv[2] === 'enviar') {
    const info = await transporter.sendMail({
      from: config.mail.from,
      to: config.mail.to,
      subject: 'Prueba de configuración - Sistema de Denuncias',
      text: 'Este es un correo de prueba. Si lo recibís, el envío funciona correctamente.',
    });
    console.log('Correo de prueba enviado. ID:', info.messageId);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
