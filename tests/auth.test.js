import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApi } from './helpers.js';

describe('Autenticação', () => {
  let api;
  before(async () => { api = await iniciarApi(); });
  after(() => api.encerrar());

  it('faz login com credenciais corretas e devolve um token', async () => {
    await api.criarUsuario('admin');
    const r = await api.req('POST', '/auth/login', {
      corpo: { email: 'admin@teste.com', senha: 'senha-forte-123' },
    });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.token);
    assert.equal(r.corpo.usuario.papel, 'admin');
  });

  it('rejeita senha incorreta com 401', async () => {
    const r = await api.req('POST', '/auth/login', {
      corpo: { email: 'admin@teste.com', senha: 'errada' },
    });
    assert.equal(r.status, 401);
  });

  it('rejeita e-mail inexistente com a mesma mensagem da senha errada', async () => {
    const r = await api.req('POST', '/auth/login', {
      corpo: { email: 'ninguem@teste.com', senha: 'qualquer' },
    });
    assert.equal(r.status, 401);
    assert.equal(r.corpo.erro, 'E-mail ou senha incorretos.');
  });

  it('bloqueia rotas protegidas sem token', async () => {
    const r = await api.req('GET', '/alunos');
    assert.equal(r.status, 401);
  });

  it('bloqueia token inválido', async () => {
    const r = await api.req('GET', '/alunos', { token: 'lixo.lixo.lixo' });
    assert.equal(r.status, 401);
  });

  it('só administradores podem registrar novos usuários', async () => {
    const tokenSecretaria = await api.criarUsuario('secretaria');
    const novo = { nome: 'Maria Souza', email: 'maria@teste.com', senha: 'outra-senha-123' };

    const negado = await api.req('POST', '/auth/registrar', { corpo: novo, token: tokenSecretaria });
    assert.equal(negado.status, 403);

    const tokenAdmin = (await api.req('POST', '/auth/login', {
      corpo: { email: 'admin@teste.com', senha: 'senha-forte-123' },
    })).corpo.token;
    const ok = await api.req('POST', '/auth/registrar', { corpo: novo, token: tokenAdmin });
    assert.equal(ok.status, 201);
    assert.equal(ok.corpo.papel, 'secretaria');
    assert.equal(ok.corpo.senha_hash, undefined);
  });

  it('exige senha com no mínimo 8 caracteres no registro', async () => {
    const tokenAdmin = (await api.req('POST', '/auth/login', {
      corpo: { email: 'admin@teste.com', senha: 'senha-forte-123' },
    })).corpo.token;
    const r = await api.req('POST', '/auth/registrar', {
      corpo: { nome: 'Ana Lima', email: 'ana@teste.com', senha: '123' },
      token: tokenAdmin,
    });
    assert.equal(r.status, 400);
  });
});
