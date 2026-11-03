import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { query } from './db.js';
import { autenticar } from './middleware/auth.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { alunosRouter } from './routes/alunos.js';
import { turmasRouter } from './routes/turmas.js';
import { matriculasRouter } from './routes/matriculas.js';

const limitador = (opcoes) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ erro: opcoes.mensagem }),
    ...opcoes,
  });

export function createApp({ loginLimit = config.loginRateLimit, globalLimit = config.globalRateLimit } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Cabeçalhos de segurança (nosniff, frame-options, CSP, HSTS, referrer-policy etc.).
  app.use(helmet());
  app.use(limitador({ windowMs: 60_000, limit: globalLimit, mensagem: 'Muitas requisições. Tente novamente em instantes.' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/saude', async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  // Limite rígido contra força bruta: só tentativas FALHAS contam.
  app.use(
    '/auth/login',
    limitador({
      windowMs: 15 * 60_000,
      limit: loginLimit,
      skipSuccessfulRequests: true,
      mensagem: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    }),
  );

  app.use('/auth', authRouter);
  app.use('/alunos', autenticar, alunosRouter);
  app.use('/turmas', autenticar, turmasRouter);
  app.use('/matriculas', autenticar, matriculasRouter);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
