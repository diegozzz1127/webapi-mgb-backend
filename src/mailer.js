import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
    });
  }
  return transporter;
}

function fmtFecha(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
}

/**
 * Envía el email del resumen de la denuncia generada.
 * @param {object} persona - { nombre, legajo, tipoDocu, dni, area }
 * @param {object} denuncia - registro insertado en ACC_Denuncias (campos DE_*)
 * @returns {Promise<void>}
 */
export async function enviarDenunciaEmail(persona, denuncia) {
  if (!config.mail.user || !config.mail.pass) {
    throw new Error('SMTP no configurado (faltan SMTP_USER / SMTP_PASS).');
  }

  const nombre = persona.nombre || `Doc. ${denuncia.DE_NumeroDocu}`;
  const legajo = persona.legajo || '-';

  const diagnosticos = [
    denuncia.DE_DiagIng1,
    denuncia.DE_DiagIng2,
    denuncia.DE_DiagIng3,
    denuncia.DE_DiagIng4,
  ].filter((d) => d && String(d).trim());

  const asunto = `Accidente de trabajo del empleado ${nombre} - Legajo ${legajo}`;

  const diagTexto = diagnosticos.length
    ? diagnosticos.map((d, i) => `  ${i + 1}. ${d}`).join('\n')
    : '  (sin diagnóstico)';

  const cuerpo = [
    'DIAGNÓSTICO:',
    diagTexto,
    '',
    'DATOS DE LA DENUNCIA:',
    `  Empleado: ${nombre}`,
    `  Legajo: ${legajo}`,
    `  Tipo de documento: ${persona.tipoDocu ?? denuncia.DE_TipoDocu ?? '-'}`,
    `  Número de documento: ${persona.dni ?? denuncia.DE_NumeroDocu ?? '-'}`,
    `  Área: ${persona.area || denuncia.DE_Area || '-'}`,
    `  Fecha de denuncia: ${fmtFecha(denuncia.DE_FecDenu)}`,
    `  Fecha de accidente: ${fmtFecha(denuncia.DE_FecAcc)}`,
    `  Abandona puesto de trabajo: ${denuncia.DE_AbanTrab ? 'Sí' : 'No'}`,
    `  Fecha de abandono: ${denuncia.DE_AbanTrab ? fmtFecha(denuncia.DE_FecAbanTrab) : '-'}`,
  ].join('\n');

  const diagHtml = diagnosticos.length
    ? `<ol>${diagnosticos.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ol>`
    : '<p>(sin diagnóstico)</p>';

  const html = `
    <h2>Diagnóstico</h2>
    ${diagHtml}
    <h3>Datos de la denuncia</h3>
    <table cellpadding="6" style="border-collapse:collapse;">
      <tr><td><b>Empleado</b></td><td>${escapeHtml(nombre)}</td></tr>
      <tr><td><b>Legajo</b></td><td>${escapeHtml(legajo)}</td></tr>
      <tr><td><b>Tipo de documento</b></td><td>${persona.tipoDocu ?? denuncia.DE_TipoDocu ?? '-'}</td></tr>
      <tr><td><b>Número de documento</b></td><td>${persona.dni ?? denuncia.DE_NumeroDocu ?? '-'}</td></tr>
      <tr><td><b>Área</b></td><td>${escapeHtml(persona.area || String(denuncia.DE_Area || '-'))}</td></tr>
      <tr><td><b>Fecha de denuncia</b></td><td>${fmtFecha(denuncia.DE_FecDenu)}</td></tr>
      <tr><td><b>Fecha de accidente</b></td><td>${fmtFecha(denuncia.DE_FecAcc)}</td></tr>
      <tr><td><b>Abandona puesto de trabajo</b></td><td>${denuncia.DE_AbanTrab ? 'Sí' : 'No'}</td></tr>
      <tr><td><b>Fecha de abandono</b></td><td>${denuncia.DE_AbanTrab ? fmtFecha(denuncia.DE_FecAbanTrab) : '-'}</td></tr>
    </table>
  `;

  await getTransporter().sendMail({
    from: config.mail.from,
    to: config.mail.to,
    subject: asunto,
    text: cuerpo,
    html,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
