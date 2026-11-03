import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { iniciarApi } from './helpers.js';

const { pool } = await import('../src/db.js');

describe('Segurança', () => {
  let api, admin;
  before(async () => {
    api = await iniciarApi();
    admin = await api.criarUsuario('admin');
  });
  after(() => api.encerrar());

  it('envia cabeçalhos de segurança e não revela a tecnologia', async () => {
    const r = await fetch(api.base + '/saude');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.headers.get('strict-transport-security'));
    assert.ok(r.headers.get('content-security-policy'));
    assert.equal(r.headers.get('x-powered-by'), null);
  });

  it('recusa token com algoritmo "none"', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1' })}.`;
    const r = await api.req('GET', '/alunos', { token });
    assert.equal(r.status, 401);
  });

  it('recusa token assinado com outro segredo', async () => {
    const token = jwt.sign({}, 'segredo-do-invasor', { subject: '1', algorithm: 'HS256' });
    const r = await api.req('GET', '/alunos', { token });
    assert.equal(r.status, 401);
  });

  it('recusa token expirado', async () => {
    const token = jwt.sign({}, 'segredo-de-teste', { subject: '1', expiresIn: -10 });
    const r = await api.req('GET', '/alunos', { token });
    assert.equal(r.status, 401);
  });

  it('bloqueia na hora o acesso de um usuário excluído', async () => {
    const token = await api.criarUsuario('secretaria', 'temp@teste.com');
    assert.equal((await api.req('GET', '/alunos', { token })).status, 200);
    await pool.query("DELETE FROM usuarios WHERE email = 'temp@teste.com'");
    assert.equal((await api.req('GET', '/alunos', { token })).status, 401);
  });

  it('aplica na hora o rebaixamento de perfil', async () => {
    const token = await api.criarUsuario('admin', 'rebaixado@teste.com');
    await pool.query("UPDATE usuarios SET papel = 'secretaria' WHERE email = 'rebaixado@teste.com'");
    const r = await api.req('DELETE', '/alunos/999', { token });
    assert.equal(r.status, 403);
  });

  it('exige senha forte no cadastro de usuários', async () => {
    const tentar = (senha) =>
      api.req('POST', '/auth/registrar', {
        corpo: { nome: 'Novo Usuario', email: `${Math.random().toString(36).slice(2)}@teste.com`, senha },
        token: admin,
      });
    assert.equal((await tentar('curta1')).status, 400);
    assert.equal((await tentar('somente-letras-aqui')).status, 400);
    assert.equal((await tentar('1234567890123')).status, 400);
    assert.equal((await tentar('a1'.repeat(40))).status, 400);
    assert.equal((await tentar('senha-boa-12345')).status, 201);
  });

  it('responde 413 para corpo acima de 100 KB', async () => {
    const r = await api.req('POST', '/alunos', {
      corpo: { nome: 'A'.repeat(200_000), email: 'grande@teste.com' },
      token: admin,
    });
    assert.equal(r.status, 413);
  });

  it('ignora campos extras enviados pelo cliente (mass assignment)', async () => {
    const r = await api.req('POST', '/alunos', {
      corpo: { nome: 'Aluno Extra', email: 'extra@teste.com', id: 999, criado_em: '2000-01-01' },
      token: admin,
    });
    assert.equal(r.status, 201);
    assert.notEqual(r.corpo.id, 999);
  });

  it('não é vulnerável a injeção SQL na busca e nos filtros', async () => {
    await api.req('POST', '/alunos', { corpo: { nome: 'Alvo Normal', email: 'alvo@teste.com' }, token: admin });
    for (const p of ["' OR '1'='1", "'; DROP TABLE alunos;--"]) {
      const r = await api.req('GET', `/alunos?busca=${encodeURIComponent(p)}`, { token: admin });
      assert.equal(r.status, 200);
      assert.equal(r.corpo.total, 0);
    }
    assert.equal((await api.req('GET', '/alunos/1%20OR%201=1', { token: admin })).status, 400);
    assert.equal((await api.req('GET', '/matriculas?aluno_id=1%20OR%201=1', { token: admin })).status, 400);
    assert.equal((await api.req('GET', '/alunos', { token: admin })).status, 200);
  });
});

describe('Segurança: configuração', () => {
  const rodar = (env) =>
    spawnSync(process.execPath, ['-e', "import('./src/config.js')"], {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
    });

  it('recusa iniciar em produção com JWT_SECRET curto ou de exemplo', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x@localhost/escola' };
    assert.notEqual(rodar({ ...base, JWT_SECRET: 'curto' }).status, 0);
    assert.notEqual(rodar({ ...base, JWT_SECRET: 'segredo-apenas-para-desenvolvimento' }).status, 0);
    assert.equal(rodar({ ...base, JWT_SECRET: 'a'.repeat(40) }).status, 0);
  });

  it('recusa rodar testes em um banco cujo nome não termina em "test"', () => {
    const r = rodar({ NODE_ENV: 'test', DATABASE_URL_TEST: 'postgres://x@localhost/escola' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /terminar em "test"/);
  });

  it('não usa DATABASE_URL como reserva nos testes', () => {
    const r = rodar({ NODE_ENV: 'test', DATABASE_URL: 'postgres://x@localhost/escola_test' });
    assert.notEqual(r.status, 0);
  });
});
