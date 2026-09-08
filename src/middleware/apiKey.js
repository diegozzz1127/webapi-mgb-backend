import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Valida una API key enviada en el header 'x-api-key'.
 * Se usa para proteger endpoints de administración (ej. alta de usuarios desde VB6).
 * Comparación en tiempo constante para evitar ataques de timing.
 */
export function apiKeyRequired(req, res, next) {
  const provided = req.headers['x-api-key'];
  const expected = config.adminApiKey;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_API_KEY no configurada en el servidor.' });
  }

  if (!provided) {
    return res.status(401).json({ error: 'Falta la API key.' });
  }

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'API key inválida.' });
  }

  next();
}
