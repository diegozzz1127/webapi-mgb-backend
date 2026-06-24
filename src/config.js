import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Falta la variable de entorno: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    server: required('DB_SERVER'),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_no_usar_en_produccion',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO || 'consultora@secureinformatica.com.ar',
  },
};
