import sql from 'mssql';
import { config } from './config.js';

let poolPromise = null;

/**
 * Devuelve un pool de conexiones reutilizable a Azure SQL.
 * Se crea una sola vez y se reutiliza en toda la app.
 */
export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config.db)
      .connect()
      .then((pool) => {
        console.log('[db] Conectado a Azure SQL Database');
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error('[db] Error al conectar a Azure SQL:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
