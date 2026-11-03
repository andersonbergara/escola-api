import { AppError } from '../errors.js';

export function rotaNaoEncontrada(_req, _res, next) {
  next(new AppError(404, 'Rota não encontrada.'));
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição grande demais.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  // Violações de integridade do PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ erro: 'Já existe um registro com estes dados.' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ erro: 'Operação bloqueada: existem registros relacionados.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
