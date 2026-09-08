import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db.js';
import { apiKeyRequired } from '../middleware/apiKey.js';

const router = Router();

// Protegido por API key (header x-api-key)
router.use(apiKeyRequired);

/**
 * POST /api/usuarios
 * Body: { usuario, password }
 * Actualiza el PasswordHash (con bcrypt) de un usuario que YA existe en UsuariosWeb.
 * El usuario debe haberse creado previamente en SQL (desde VB6).
 * Si el usuario no existe, responde 404.
 */
router.post('/', async (req, res) => {
  const { usuario, password } = req.body || {};

  if (!usuario || !String(usuario).trim()) {
    return res.status(400).json({ error: 'El usuario es obligatorio.' });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: 'La contraseña es obligatoria (mínimo 4 caracteres).' });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);

    const pool = await getPool();
    const result = await pool
      .request()
      .input('usuario', sql.NVarChar(100), String(usuario).trim())
      .input('hash', sql.NVarChar(255), passwordHash)
      .query(
        `UPDATE dbo.UsuariosWeb
         SET PasswordHash = @hash
         WHERE Usuario = @usuario`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Usuario inexistente. Debe crearse previamente.' });
    }

    return res.json({
      usuario: String(usuario).trim(),
      actualizado: true,
    });
  } catch (err) {
    console.error('[usuarios/update] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
