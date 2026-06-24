/**
 * Crea (o actualiza) un usuario en la base de datos con la contraseña hasheada.
 *
 * Uso:
 *   node src/scripts/createUser.js <usuario> <password>
 *
 * Ejemplo:
 *   node src/scripts/createUser.js admin MiClaveSegura123
 */
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db.js';

async function main() {
  const [, , usuario, password] = process.argv;

  if (!usuario || !password) {
    console.error('Uso: node src/scripts/createUser.js <usuario> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await getPool();

  await pool
    .request()
    .input('usuario', sql.NVarChar(100), usuario)
    .input('hash', sql.NVarChar(255), passwordHash)
    .query(
      `MERGE dbo.UsuariosWeb AS target
       USING (SELECT @usuario AS Usuario) AS src
       ON target.Usuario = src.Usuario
       WHEN MATCHED THEN
         UPDATE SET PasswordHash = @hash, Activo = 1
       WHEN NOT MATCHED THEN
         INSERT (Usuario, PasswordHash) VALUES (@usuario, @hash);`
    );

  console.log(`Usuario "${usuario}" creado/actualizado correctamente.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
