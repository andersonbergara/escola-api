import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApi } from './helpers.js';

describe('Alunos', () => {
  let api, admin, secretaria;
  before(async () => {
    api = await iniciarApi();
    admin = await api.criarUsuario('admin');
    secretaria = await api.criarUsuario('secretaria');
  });
  after(() => api.encerrar());

  let mariaId;
  const aluno = { nome: 'João da Silva', email: 'Joao@Exemplo.com', telefone: '11999990000' };

  it('cria aluno e normaliza o e-mail para minúsculas', async () => {
    const r = await api.req('POST', '/alunos', { corpo: aluno, token: secretaria });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.email, 'joao@exemplo.com');
  });

  it('impede e-mail duplicado com 409', async () => {
    const r = await api.req('POST', '/alunos', { corpo: aluno, token: secretaria });
    assert.equal(r.status, 409);
  });

  it('valida os dados de entrada com 400 e detalha os campos', async () => {
    const r = await api.req('POST', '/alunos', {
      corpo: { nome: 'A', email: 'nao-e-email' },
      token: secretaria,
    });
    assert.equal(r.status, 400);
    const campos = r.corpo.detalhes.map((d) => d.campo);
    assert.ok(campos.includes('nome'));
    assert.ok(campos.includes('email'));
  });

  it('lista com paginação e busca por nome', async () => {
    const maria = await api.req('POST', '/alunos', {
      corpo: { nome: 'Maria Oliveira', email: 'maria@exemplo.com' },
      token: secretaria,
    });
    mariaId = maria.corpo.id;
    const todos = await api.req('GET', '/alunos?limite=1&pagina=2', { token: secretaria });
    assert.equal(todos.corpo.total, 2);
    assert.equal(todos.corpo.dados.length, 1);

    const busca = await api.req('GET', '/alunos?busca=maria', { token: secretaria });
    assert.equal(busca.corpo.total, 1);
    assert.equal(busca.corpo.dados[0].nome, 'Maria Oliveira');
  });

  it('atualiza um aluno existente e devolve 404 para um inexistente', async () => {
    const ok = await api.req('PUT', '/alunos/1', {
      corpo: { nome: 'João Silva Jr.', email: 'joao@exemplo.com' },
      token: secretaria,
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.corpo.nome, 'João Silva Jr.');

    const naoExiste = await api.req('GET', '/alunos/999', { token: secretaria });
    assert.equal(naoExiste.status, 404);
  });

  it('somente administrador pode excluir', async () => {
    const negado = await api.req('DELETE', `/alunos/${mariaId}`, { token: secretaria });
    assert.equal(negado.status, 403);
    const ok = await api.req('DELETE', `/alunos/${mariaId}`, { token: admin });
    assert.equal(ok.status, 204);
  });
});
