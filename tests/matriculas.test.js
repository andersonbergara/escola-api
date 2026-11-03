import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApi } from './helpers.js';

describe('Turmas e matrículas', () => {
  let api, token, admin;
  const turma = { nome: 'Inglês Básico A', curso: 'Inglês', professor: 'Maria', horario: 'Seg e Qua 19h', vagas: 2 };

  before(async () => {
    api = await iniciarApi();
    token = await api.criarUsuario('secretaria');
    admin = await api.criarUsuario('admin');
    await api.req('POST', '/turmas', { corpo: turma, token });
    for (const n of [1, 2, 3]) {
      await api.req('POST', '/alunos', {
        corpo: { nome: `Aluno ${n}`, email: `aluno${n}@exemplo.com` },
        token,
      });
    }
  });
  after(() => api.encerrar());

  it('cria turma com vagas livres calculadas', async () => {
    const r = await api.req('GET', '/turmas/1', { token });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.vagas, 2);
    assert.equal(r.corpo.vagas_livres, 2);
  });

  it('rejeita turma com número de vagas inválido', async () => {
    const r = await api.req('POST', '/turmas', { corpo: { ...turma, vagas: 0 }, token });
    assert.equal(r.status, 400);
  });

  it('matricula aluno e atualiza as vagas', async () => {
    const r = await api.req('POST', '/matriculas', { corpo: { aluno_id: 1, turma_id: 1 }, token });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.status, 'ativa');
    const t = await api.req('GET', '/turmas/1', { token });
    assert.equal(t.corpo.vagas_ocupadas, 1);
    assert.equal(t.corpo.vagas_livres, 1);
  });

  it('impede matrícula duplicada', async () => {
    const r = await api.req('POST', '/matriculas', { corpo: { aluno_id: 1, turma_id: 1 }, token });
    assert.equal(r.status, 409);
  });

  it('retorna 404 para aluno ou turma inexistentes', async () => {
    const semAluno = await api.req('POST', '/matriculas', { corpo: { aluno_id: 99, turma_id: 1 }, token });
    assert.equal(semAluno.status, 404);
    const semTurma = await api.req('POST', '/matriculas', { corpo: { aluno_id: 1, turma_id: 99 }, token });
    assert.equal(semTurma.status, 404);
  });

  it('bloqueia matrícula quando a turma está lotada', async () => {
    await api.req('POST', '/matriculas', { corpo: { aluno_id: 2, turma_id: 1 }, token });
    const r = await api.req('POST', '/matriculas', { corpo: { aluno_id: 3, turma_id: 1 }, token });
    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /vagas/);
  });

  it('nunca ultrapassa as vagas com matrículas simultâneas', async () => {
    await api.req('POST', '/turmas', { corpo: { ...turma, nome: 'Turma Concorrência', vagas: 1 }, token });
    for (const n of [4, 5, 6, 7]) {
      await api.req('POST', '/alunos', { corpo: { nome: `Aluno ${n}`, email: `aluno${n}@exemplo.com` }, token });
    }
    const respostas = await Promise.all(
      [4, 5, 6, 7].map((aluno_id) => api.req('POST', '/matriculas', { corpo: { aluno_id, turma_id: 2 }, token })),
    );
    const criadas = respostas.filter((r) => r.status === 201).length;
    assert.equal(criadas, 1);
    assert.equal(respostas.filter((r) => r.status === 409).length, 3);
  });

  it('cancelar libera a vaga e permite reativar a matrícula', async () => {
    const lista = await api.req('GET', '/matriculas?aluno_id=2&turma_id=1', { token });
    const id = lista.corpo.dados[0].id;

    const cancelada = await api.req('PATCH', `/matriculas/${id}/cancelar`, { token });
    assert.equal(cancelada.corpo.status, 'cancelada');

    const aluno3 = await api.req('POST', '/matriculas', { corpo: { aluno_id: 3, turma_id: 1 }, token });
    assert.equal(aluno3.status, 201);

    // Turma lotada de novo: reativar o aluno 2 deve falhar.
    const reativarLotada = await api.req('POST', '/matriculas', { corpo: { aluno_id: 2, turma_id: 1 }, token });
    assert.equal(reativarLotada.status, 409);
  });

  it('não permite excluir turma com matrículas associadas', async () => {
    const r = await api.req('DELETE', '/turmas/1', { token: admin });
    assert.equal(r.status, 409);
  });

  it('filtra matrículas por status', async () => {
    const r = await api.req('GET', '/matriculas?status=cancelada', { token });
    assert.equal(r.status, 200);
    assert.ok(r.corpo.dados.every((m) => m.status === 'cancelada'));
  });
});
