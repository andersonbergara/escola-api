import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { senhaSchema } from '../src/routes/auth.js';

const { ADMIN_NOME, ADMIN_EMAIL, ADMIN_SENHA } = process.env;
if (!ADMIN_EMAIL || !ADMIN_SENHA) {
  console.error('Defina ADMIN_EMAIL e ADMIN_SENHA no .env antes de rodar o seed.');
  process.exit(1);
}

// O administrador inicial segue a mesma política de senha dos demais usuários.
const validacao = senhaSchema.safeParse(ADMIN_SENHA);
if (!validacao.success) {
  console.error(`ADMIN_SENHA recusada: ${validacao.error.issues.map((i) => i.message).join(' ')}`);
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
