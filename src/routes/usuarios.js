import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db.js';
import { apiKeyRequired } from '../middleware/apiKey.js';

const router = Router();

// Protegido por API key (header x-api-key)
router.use(apiKeyRequired);

/**
 * POST /api/usuarios
 * Body: { usuario, password, activo? }
 * Crea el usuario o, si ya existe, actualiza su contraseña (upsert).
 * El backend genera el hash bcrypt (VB6 solo envía la contraseña en texto).
 */
router.post('/', async (req, res) => {
  const { usuario, password, activo } = req.body || {};

  if (!usuario || !String(usuario).trim()) {
    return res.status(400).json({ error: 'El usuario es obligatorio.' });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: 'La contraseña es obligatoria (mínimo 4 caracteres).' });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const activoBit = activo === false || activo === 0 || activo === '0' ? 0 : 1;

    const pool = await getPool();
    const result = await pool
      .request()
      .input('usuario', sql.NVarChar(100), String(usuario).trim())
      .input('hash', sql.NVarChar(255), passwordHash)
      .input('activo', sql.Bit, activoBit)
      .query(
        `MERGE dbo.UsuariosWeb AS target
         USING (SELECT @usuario AS Usuario) AS src
         ON target.Usuario = src.Usuario
         WHEN MATCHED THEN
           UPDATE SET PasswordHash = @hash, Activo = @activo
         WHEN NOT MATCHED THEN
           INSERT (Usuario, PasswordHash, Activo) VALUES (@usuario, @hash, @activo)
         OUTPUT $action AS accion;`
      );

    const accion = result.recordset[0]?.accion; // 'INSERT' o 'UPDATE'
    return res.status(accion === 'INSERT' ? 201 : 200).json({
      usuario: String(usuario).trim(),
      creado: accion === 'INSERT',
      actualizado: accion === 'UPDATE',
    });
  } catch (err) {
    console.error('[usuarios/upsert] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
