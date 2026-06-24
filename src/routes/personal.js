import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Requiere estar autenticado
router.use(authRequired);

/**
 * GET /api/personal/:dni
 * Busca un operario en ACC_Personal por número de documento (PE_NumeroDocu)
 * y trae la descripción del área desde ACC_Areas.
 * Responde 404 con "Personal inexistente" si no se encuentra.
 */
router.get('/:dni', async (req, res) => {
  const dni = String(req.params.dni || '').trim();

  if (!/^\d+$/.test(dni)) {
    return res.status(400).json({ error: 'El DNI debe ser numérico.' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('dni', sql.Decimal(18, 0), dni)
      .query(
        `SELECT TOP 1
            p.PE_Legajo,
            p.PE_TipoDocu,
            p.PE_NumeroDocu,
            p.PE_Nombre,
            p.PE_Domicilio,
            p.PE_FechaNacimiento,
            p.PE_FechaIngreso,
            p.PE_Area,
            a.AR_Descripcion
         FROM dbo.ACC_Personal p
         LEFT JOIN dbo.ACC_Areas a ON a.AR_Area = p.PE_Area
         WHERE p.PE_NumeroDocu = @dni`
      );

    const persona = result.recordset[0];
    if (!persona) {
      return res.status(404).json({ error: 'Personal inexistente' });
    }

    return res.json({
      legajo: persona.PE_Legajo,
      tipoDocu: persona.PE_TipoDocu,
      dni: persona.PE_NumeroDocu,
      nombre: persona.PE_Nombre,
      domicilio: persona.PE_Domicilio,
      fechaNacimiento: persona.PE_FechaNacimiento,
      fechaIngreso: persona.PE_FechaIngreso,
      areaCodigo: persona.PE_Area,
      area: persona.AR_Descripcion,
    });
  } catch (err) {
    console.error('[personal/get] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
