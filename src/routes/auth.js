import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { usuario, password }
 * Verifica credenciales contra la tabla UsuariosWeb y devuelve un JWT.
 */
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body || {};

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('usuario', sql.NVarChar(100), usuario)
      .query(
        'SELECT Id, Usuario, PasswordHash, Activo FROM dbo.UsuariosWeb WHERE Usuario = @usuario'
      );

    const user = result.recordset[0];

    // Mensaje genérico para no revelar si el usuario existe
    if (!user || !user.Activo) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { sub: user.Id, usuario: user.Usuario },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.json({
      token,
      usuario: user.Usuario,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (err) {
    console.error('[auth/login] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
