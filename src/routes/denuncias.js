import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { enviarDenunciaEmail } from '../mailer.js';

const router = Router();

// Todas las rutas de denuncias requieren estar autenticado
router.use(authRequired);

const MAX_DIAG = 80;

/**
 * GET /api/denuncias
 * Lista las denuncias cargadas (más recientes primero), con nombre del
 * operario y descripción del área.
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT
          d.DE_TipoDocu,
          d.DE_NumeroDocu,
          d.DE_Area,
          d.DE_FecDenu,
          d.DE_FecAcc,
          d.DE_DiagIng1,
          d.DE_DiagIng2,
          d.DE_DiagIng3,
          d.DE_DiagIng4,
          d.DE_AbanTrab,
          d.DE_FecAbanTrab,
          p.PE_Nombre,
          a.AR_Descripcion
       FROM dbo.ACC_Denuncias d
       LEFT JOIN dbo.ACC_Personal p ON p.PE_NumeroDocu = d.DE_NumeroDocu
       LEFT JOIN dbo.ACC_Areas a ON a.AR_Area = d.DE_Area
       ORDER BY d.DE_FecDenu DESC`
    );
    return res.json(result.recordset);
  } catch (err) {
    console.error('[denuncias/list] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/denuncias
 * Body: {
 *   dni,                  -> identifica al operario (ACC_Personal)
 *   fechaDenuncia,        -> DE_FecDenu
 *   fechaAccidente,       -> DE_FecAcc
 *   diag1..diag4,         -> DE_DiagIng1..4 (máx 80 c/u)
 *   abandonaTrabajo,      -> DE_AbanTrab (bool)
 *   fechaAbandono,        -> DE_FecAbanTrab (requerida si abandonaTrabajo = true)
 *   tareaHabitual,        -> DE_TareaHabitual (bool)
 *   ordenSuperior,        -> DE_OrdenSuperior (bool)
 *   horarioLugar,         -> DE_HorarioLugar (texto máx 200)
 *   autorizacionSalida    -> DE_AutorizacionSalida (bool)
 * }
 * Los campos DE_TipoDocu, DE_NumeroDocu y DE_Area se completan desde ACC_Personal.
 */
router.post('/', async (req, res) => {
  const {
    dni,
    fechaDenuncia,
    fechaAccidente,
    diag1,
    diag2,
    diag3,
    diag4,
    abandonaTrabajo,
    fechaAbandono,
    tareaHabitual,
    ordenSuperior,
    horarioLugar,
    autorizacionSalida,
  } = req.body || {};

  if (!dni || !/^\d+$/.test(String(dni).trim())) {
    return res.status(400).json({ error: 'DNI del operario inválido.' });
  }

  if (!fechaDenuncia) {
    return res.status(400).json({ error: 'La fecha de denuncia es obligatoria.' });
  }

  const fDenuncia = new Date(fechaDenuncia);
  if (Number.isNaN(fDenuncia.getTime())) {
    return res.status(400).json({ error: 'La fecha de denuncia no es válida.' });
  }

  let fAccidente = null;
  if (fechaAccidente) {
    fAccidente = new Date(fechaAccidente);
    if (Number.isNaN(fAccidente.getTime())) {
      return res.status(400).json({ error: 'La fecha de accidente no es válida.' });
    }
  }

  if (!diag1 || !String(diag1).trim()) {
    return res.status(400).json({ error: 'El primer renglón de diagnóstico es obligatorio.' });
  }

  const diags = [diag1, diag2, diag3, diag4].map((d) => (d ? String(d).trim() : null));
  for (const d of diags) {
    if (d && d.length > MAX_DIAG) {
      return res
        .status(400)
        .json({ error: `Cada renglón de diagnóstico admite máximo ${MAX_DIAG} caracteres.` });
    }
  }

  const abandona = abandonaTrabajo === true || abandonaTrabajo === 'true' || abandonaTrabajo === 1;
  let fAbandono = null;
  if (abandona) {
    if (!fechaAbandono) {
      return res
        .status(400)
        .json({ error: 'Si abandona el puesto de trabajo, la fecha de abandono es obligatoria.' });
    }
    fAbandono = new Date(fechaAbandono);
    if (Number.isNaN(fAbandono.getTime())) {
      return res.status(400).json({ error: 'La fecha de abandono no es válida.' });
    }
  }

  // Nuevos campos SI/NO (deben venir definidos: true o false)
  const toBoolStrict = (v) => {
    if (v === true || v === 'true' || v === 1 || v === '1' || v === 'si' || v === 'SI') return true;
    if (v === false || v === 'false' || v === 0 || v === '0' || v === 'no' || v === 'NO') return false;
    return null;
  };

  const bTareaHabitual = toBoolStrict(tareaHabitual);
  const bOrdenSuperior = toBoolStrict(ordenSuperior);
  const bAutorizacionSalida = toBoolStrict(autorizacionSalida);

  if (bTareaHabitual === null) {
    return res.status(400).json({ error: 'Indicá si la tarea correspondía a su tarea habitual (Sí/No).' });
  }
  if (bOrdenSuperior === null) {
    return res.status(400).json({ error: 'Indicá si la tarea respondía a la orden de un superior (Sí/No).' });
  }
  if (bAutorizacionSalida === null) {
    return res.status(400).json({ error: 'Indicá si tenía autorización para salir del establecimiento (Sí/No).' });
  }

  const horarioLugarTexto = horarioLugar ? String(horarioLugar).trim() : null;
  if (horarioLugarTexto && horarioLugarTexto.length > 200) {
    return res.status(400).json({ error: 'El horario y lugar admite máximo 200 caracteres.' });
  }

  try {
    const pool = await getPool();

    // Obtener datos del operario desde ACC_Personal (con nombre, legajo y área)
    const persona = await pool
      .request()
      .input('dni', sql.Decimal(18, 0), String(dni).trim())
      .query(
        `SELECT TOP 1
            p.PE_TipoDocu, p.PE_NumeroDocu, p.PE_Area,
            p.PE_Nombre, p.PE_Legajo, a.AR_Descripcion
         FROM dbo.ACC_Personal p
         LEFT JOIN dbo.ACC_Areas a ON a.AR_Area = p.PE_Area
         WHERE p.PE_NumeroDocu = @dni`
      );

    const op = persona.recordset[0];
    if (!op) {
      return res.status(404).json({ error: 'Personal inexistente' });
    }

    const result = await pool
      .request()
      .input('tipoDocu', sql.Int, op.PE_TipoDocu)
      .input('numeroDocu', sql.Decimal(18, 0), op.PE_NumeroDocu)
      .input('area', sql.Int, op.PE_Area)
      .input('fecDenu', sql.DateTime, fDenuncia)
      .input('fecAcc', sql.DateTime, fAccidente)
      .input('diag1', sql.NVarChar(MAX_DIAG), diags[0])
      .input('diag2', sql.NVarChar(MAX_DIAG), diags[1])
      .input('diag3', sql.NVarChar(MAX_DIAG), diags[2])
      .input('diag4', sql.NVarChar(MAX_DIAG), diags[3])
      .input('abanTrab', sql.Bit, abandona ? 1 : 0)
      .input('fecAbanTrab', sql.DateTime, fAbandono)
      .input('aceptaDenu', sql.NVarChar(1), 'P')
      .input('tareaHabitual', sql.Bit, bTareaHabitual ? 1 : 0)
      .input('ordenSuperior', sql.Bit, bOrdenSuperior ? 1 : 0)
      .input('horarioLugar', sql.NVarChar(200), horarioLugarTexto)
      .input('autorizacionSalida', sql.Bit, bAutorizacionSalida ? 1 : 0)
      .input('usuarioWeb', sql.Int, req.user?.id ?? null)
      .query(
        `INSERT INTO dbo.ACC_Denuncias
            (DE_TipoDocu, DE_NumeroDocu, DE_Area, DE_FecDenu, DE_FecAcc,
             DE_DiagIng1, DE_DiagIng2, DE_DiagIng3, DE_DiagIng4,
             DE_AbanTrab, DE_FecAbanTrab, DE_AceptaDenu,
             DE_TareaHabitual, DE_OrdenSuperior, DE_HorarioLugar, DE_AutorizacionSalida,
             DE_UsuarioWeb)
         OUTPUT INSERTED.*
         VALUES
            (@tipoDocu, @numeroDocu, @area, @fecDenu, @fecAcc,
             @diag1, @diag2, @diag3, @diag4,
             @abanTrab, @fecAbanTrab, @aceptaDenu,
             @tareaHabitual, @ordenSuperior, @horarioLugar, @autorizacionSalida,
             @usuarioWeb)`
      );

    const creada = result.recordset[0];

    // Enviar el email del resumen. La denuncia ya quedó grabada; si el envío
    // falla, se informa pero no se revierte el alta.
    let emailEnviado = false;
    let emailError = null;
    try {
      await enviarDenunciaEmail(
        {
          nombre: op.PE_Nombre,
          legajo: op.PE_Legajo,
          tipoDocu: op.PE_TipoDocu,
          dni: op.PE_NumeroDocu,
          area: op.AR_Descripcion,
        },
        creada
      );
      emailEnviado = true;
    } catch (mailErr) {
      emailError = mailErr.message;
      console.error('[denuncias/create] Email no enviado:', mailErr.message);
    }

    return res.status(201).json({ ...creada, emailEnviado, emailError });
  } catch (err) {
    console.error('[denuncias/create] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
