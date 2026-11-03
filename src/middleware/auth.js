import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';

export function autenticar(req, _res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de acesso ausente.');
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuario = { id: Number(payload.sub), papel: payload.papel };
    next();
  } catch {
    throw new AppError(401, 'Token inválido ou expirado.');
  }
}

export const exigirPapel = (...papeis) => (req, _res, next) => {
  if (!papeis.includes(req.usuario.papel)) {
    throw new AppError(403, 'Você não tem permissão para esta ação.');
  }
  next();
};
