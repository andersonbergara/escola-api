import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';

export const ALGORITMO_JWT = 'HS256';

export async function autenticar(req, _res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de acesso ausente.');
  }

  let payload;
  try {
    // O algoritmo é fixado: tokens "alg: none" ou de outro algoritmo são recusados.
    payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITMO_JWT] });
  } catch {
    throw new AppError(401, 'Token inválido ou expirado.');
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id)) throw new AppError(401, 'Token inválido ou expirado.');

  // O perfil vem do banco a cada requisição, e não do token. Assim, um usuário
  // excluído perde o acesso na hora, e um rebaixamento de perfil vale imediatamente.
  const { rows } = await query('SELECT id, papel FROM usuarios WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(401, 'Token inválido ou expirado.');

  req.usuario = { id: rows[0].id, papel: rows[0].papel };
  next();
}

export const exigirPapel = (...papeis) => (req, _res, next) => {
  if (!papeis.includes(req.usuario.papel)) {
    throw new AppError(403, 'Você não tem permissão para esta ação.');
  }
  next();
};
