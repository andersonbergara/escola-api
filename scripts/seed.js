import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const { ADMIN_NOME, ADMIN_EMAIL, ADMIN_SENHA } = process.env;
if (!ADMIN_EMAIL || !ADMIN_SENHA) {
  console.error('Defina ADMIN_EMAIL e ADMIN_SENHA no .env antes de rodar o seed.');
  process.exit(1);
}

const hash = await bcrypt.hash(ADMIN_SENHA, 10);
await pool.query(
  `INSERT INTO usuarios (nome, email, senha_hash, papel)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email) DO NOTHING`,
  [ADMIN_NOME || 'Administrador', ADMIN_EMAIL.toLowerCase(), hash],
);
console.log(`Administrador garantido: ${ADMIN_EMAIL}`);
await pool.end();
