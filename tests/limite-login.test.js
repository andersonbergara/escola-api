import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApi } from './helpers.js';

describe('Segurança: limite de tentativas de login', () => {
  let api;
  before(async () => { api = await iniciarApi({ loginLimit: 3 }); await api.criarUsuario('admin'); });
  after(() => api.encerrar());

  it('bloqueia com 429 após 3 tentativas falhas, mesmo com a senha certa depois', async () => {
    const errada = { corpo: { email: 'admin@teste.com', senha: 'errada-errada' } };
    for (let i = 0; i < 3; i++) assert.equal((await api.req('POST', '/auth/login', errada)).status, 401);
    assert.equal((await api.req('POST', '/auth/login', errada)).status, 429);
    const certa = await api.req('POST', '/auth/login', { corpo: { email: 'admin@teste.com', senha: 'senha-forte-123' } });
    assert.equal(certa.status, 429);
  });
});
