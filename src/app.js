import express from 'express';
import { query } from './db.js';
import { autenticar } from './middleware/auth.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { alunosRouter } from './routes/alunos.js';
import { turmasRouter } from './routes/turmas.js';
import { matriculasRouter } from './routes/matriculas.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/saude', async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/alunos', autenticar, alunosRouter);
  app.use('/turmas', autenticar, turmasRouter);
  app.use('/matriculas', autenticar, matriculasRouter);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
