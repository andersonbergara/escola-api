import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import { AppError, notFound } from '../errors.js';
import { idParam, paginacao, parse } from '../validate.js';

export const matriculasRouter = Router();

const novaMatriculaSchema = z.object({
  aluno_id: z.number().int().positive(),
  turma_id: z.number().int().positive(),
});

const filtrosSchema = paginacao.extend({
  aluno_id: z.coerce.number().int().positive().optional(),
  turma_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['ativa', 'cancelada']).optional(),
});

matriculasRouter.get('/', async (req, res) => {
  const { pagina, limite, ...filtros } = parse(filtrosSchema, req.query);
  const condicoes = [];
  const params = [];
  for (const [campo, valor] of Object.entries(filtros)) {
    params.push(valor);
    condicoes.push(`m.${campo} = $${params.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT m.id, m.status, m.criado_em,
            a.id AS aluno_id, a.nome AS aluno_nome,
            t.id AS turma_id, t.nome AS turma_nome
     FROM matriculas m
     JOIN alunos a ON a.id = m.aluno_id
     JOIN turmas t ON t.id = m.turma_id
     ${where}
     ORDER BY m.id DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
    params,
  );
  const { rows: total } = await query(`SELECT count(*)::int AS total FROM matriculas m ${where}`, params);
  res.json({ dados: rows, pagina, limite, total: total[0].total });
});

matriculasRouter.post('/', async (req, res) => {
  const { aluno_id, turma_id } = parse(novaMatriculaSchema, req.body);

  const matricula = await withTransaction(async (client) => {
    // Trava a linha da turma: duas matrículas simultâneas não conseguem ocupar a mesma última vaga.
    const { rows: turmas } = await client.query('SELECT vagas FROM turmas WHERE id = $1 FOR UPDATE', [turma_id]);
    if (!turmas[0]) throw notFound('Turma');

    const { rows: alunos } = await client.query('SELECT 1 FROM alunos WHERE id = $1', [aluno_id]);
    if (!alunos[0]) throw notFound('Aluno');

    const { rows: ocupadas } = await client.query(
      "SELECT count(*)::int AS n FROM matriculas WHERE turma_id = $1 AND status = 'ativa'",
      [turma_id],
    );
    if (ocupadas[0].n >= turmas[0].vagas) {
      throw new AppError(409, 'A turma não possui vagas disponíveis.');
    }

    // Se o aluno já esteve na turma e cancelou, reativa a mesma matrícula.
    const { rows } = await client.query(
      `INSERT INTO matriculas (aluno_id, turma_id) VALUES ($1, $2)
       ON CONFLICT (aluno_id, turma_id) DO UPDATE SET status = 'ativa'
         WHERE matriculas.status = 'cancelada'
       RETURNING id, aluno_id, turma_id, status, criado_em`,
      [aluno_id, turma_id],
    );
    if (!rows[0]) throw new AppError(409, 'O aluno já está matriculado nesta turma.');
    return rows[0];
  });

  res.status(201).json(matricula);
});

matriculasRouter.patch('/:id/cancelar', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { rows } = await query(
    `UPDATE matriculas SET status = 'cancelada' WHERE id = $1
     RETURNING id, aluno_id, turma_id, status, criado_em`,
    [id],
  );
  if (!rows[0]) throw notFound('Matrícula');
  res.json(rows[0]);
});
