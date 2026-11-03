import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { notFound } from '../errors.js';
import { idParam, paginacao, parse } from '../validate.js';
import { exigirPapel } from '../middleware/auth.js';

export const turmasRouter = Router();

const turmaSchema = z.object({
  nome: z.string().trim().min(2),
  curso: z.string().trim().min(2),
  professor: z.string().trim().min(2),
  horario: z.string().trim().min(3),
  vagas: z.number().int().positive(),
});

// `vagas_ocupadas` e `vagas_livres` são calculadas a partir das matrículas ativas.
const SELECT_TURMA = `
  SELECT t.id, t.nome, t.curso, t.professor, t.horario, t.vagas, t.criado_em,
         COUNT(m.id) FILTER (WHERE m.status = 'ativa')::int AS vagas_ocupadas,
         (t.vagas - COUNT(m.id) FILTER (WHERE m.status = 'ativa'))::int AS vagas_livres
  FROM turmas t
  LEFT JOIN matriculas m ON m.turma_id = t.id`;

turmasRouter.get('/', async (req, res) => {
  const { pagina, limite } = parse(paginacao, req.query);
  const { rows } = await query(
    `${SELECT_TURMA} GROUP BY t.id ORDER BY t.nome LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
  );
  const { rows: total } = await query('SELECT count(*)::int AS total FROM turmas');
  res.json({ dados: rows, pagina, limite, total: total[0].total });
});

turmasRouter.get('/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { rows } = await query(`${SELECT_TURMA} WHERE t.id = $1 GROUP BY t.id`, [id]);
  if (!rows[0]) throw notFound('Turma');
  res.json(rows[0]);
});

turmasRouter.post('/', async (req, res) => {
  const d = parse(turmaSchema, req.body);
  const { rows } = await query(
    `INSERT INTO turmas (nome, curso, professor, horario, vagas)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [d.nome, d.curso, d.professor, d.horario, d.vagas],
  );
  const { rows: turma } = await query(`${SELECT_TURMA} WHERE t.id = $1 GROUP BY t.id`, [rows[0].id]);
  res.status(201).json(turma[0]);
});

turmasRouter.put('/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const d = parse(turmaSchema, req.body);
  const { rowCount } = await query(
    `UPDATE turmas SET nome = $1, curso = $2, professor = $3, horario = $4, vagas = $5
     WHERE id = $6`,
    [d.nome, d.curso, d.professor, d.horario, d.vagas, id],
  );
  if (!rowCount) throw notFound('Turma');
  const { rows } = await query(`${SELECT_TURMA} WHERE t.id = $1 GROUP BY t.id`, [id]);
  res.json(rows[0]);
});

turmasRouter.delete('/:id', exigirPapel('admin'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { rowCount } = await query('DELETE FROM turmas WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Turma');
  res.status(204).end();
});
