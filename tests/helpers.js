// Deve ser importado antes de qualquer módulo da aplicação.
process.env.NODE_ENV = 'test';

import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

/** Sobe a API em uma porta livre e devolve um cliente HTTP simples. */
export async function iniciarApi() {
  await pool.query(schema);
  await pool.query('TRUNCATE matriculas, turmas, alunos, usuarios RESTART IDENTITY CASCADE');

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function req(metodo, caminho, { corpo, token } = {}) {
    const resposta = await fetch(base + caminho, {
      method: metodo,
      headers: {
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await resposta.text();
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
  }

  async function criarUsuario(papel, email = `${papel}@teste.com`) {
    const hash = await bcrypt.hash('senha-forte-123', 4);
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4)',
      [`Usuário ${papel}`, email, hash, papel],
    );
    const { corpo } = await req('POST', '/auth/login', { corpo: { email, senha: 'senha-forte-123' } });
    return corpo.token;
  }

  async function encerrar() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { req, criarUsuario, encerrar };
}
