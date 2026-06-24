import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Middleware que valida el token JWT enviado en el header Authorization.
 * Formato esperado: "Authorization: Bearer <token>"
 */
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autorizado. Falta el token.' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, usuario: payload.usuario };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}
