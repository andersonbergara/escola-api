import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { notFound } from '../errors.js';
import { idParam, paginacao, parse } from '../validate.js';
import { exigirPapel } from '../middleware/auth.js';

export const alunosRouter = Router();

const alunoSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  telefone: z.string().trim().min(8).max(20).nullish(),
  data_nascimento: z.iso.date().nullish(),
});

const COLUNAS = 'id, nome, email, telefone, data_nascimento, criado_em';

alunosRouter.get('/', async (req, res) => {
  const { pagina, limite } = parse(paginacao, req.query);
  const busca = typeof req.query.busca === 'string' ? `%${req.query.busca.trim()}%` : null;
  const filtro = busca ? 'WHERE nome ILIKE $1 OR email ILIKE $1' : '';
  const params = busca ? [busca] : [];

  const { rows } = await query(
    `SELECT ${COLUNAS} FROM alunos ${filtro}
     ORDER BY nome LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
    params,
  );
  const { rows: total } = await query(`SELECT count(*)::int AS total FROM alunos ${filtro}`, params);
  res.json({ dados: rows, pagina, limite, total: total[0].total });
});

alunosRouter.get('/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { rows } = await query(`SELECT ${COLUNAS} FROM alunos WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Aluno');
  res.json(rows[0]);
});

alunosRouter.post('/', async (req, res) => {
  const d = parse(alunoSchema, req.body);
  const { rows } = await query(
    `INSERT INTO alunos (nome, email, telefone, data_nascimento)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUNAS}`,
    [d.nome, d.email, d.telefone ?? null, d.data_nascimento ?? null],
  );
  res.status(201).json(rows[0]);
});

alunosRouter.put('/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const d = parse(alunoSchema, req.body);
  const { rows } = await query(
    `UPDATE alunos SET nome = $1, email = $2, telefone = $3, data_nascimento = $4
     WHERE id = $5 RETURNING ${COLUNAS}`,
    [d.nome, d.email, d.telefone ?? null, d.data_nascimento ?? null, id],
  );
  if (!rows[0]) throw notFound('Aluno');
  res.json(rows[0]);
});

alunosRouter.delete('/:id', exigirPapel('admin'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { rowCount } = await query('DELETE FROM alunos WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Aluno');
  res.status(204).end();
});
