import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { parse } from '../validate.js';
import { ALGORITMO_JWT, autenticar, exigirPapel } from '../middleware/auth.js';

export const authRouter = Router();

// Hash fictício com o mesmo custo dos reais. Quando o e-mail não existe, comparamos
// a senha com ele, para que a resposta demore o mesmo tempo e não revele quais e-mails existem.
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-igualar-o-tempo', 10);

const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  senha: z.string().min(1).max(200),
});

export const senhaSchema = z
  .string()
  .min(10, 'A senha deve ter ao menos 10 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra.')
  .regex(/\d/, 'A senha deve conter ao menos um número.');

const registrarSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  senha: senhaSchema,
  papel: z.enum(['admin', 'secretaria']).default('secretaria'),
});

authRouter.post('/login', async (req, res) => {
  const { email, senha } = parse(loginSchema, req.body);
  const { rows } = await query('SELECT id, nome, senha_hash, papel FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];

  const senhaCorreta = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FICTICIO);
  if (!usuario || !senhaCorreta) {
    console.warn(`[auth] tentativa de login recusada ip=${req.ip}`);
    throw new AppError(401, 'E-mail ou senha incorretos.');
  }

  // O token carrega só o identificador: o perfil é consultado no banco a cada requisição.
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: ALGORITMO_JWT,
    subject: String(usuario.id),
    expiresIn: config.jwtExpiresIn,
  });
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel } });
});

// Somente administradores criam novos usuários.
authRouter.post('/registrar', autenticar, exigirPapel('admin'), async (req, res) => {
  const dados = parse(registrarSchema, req.body);
  const senhaHash = await bcrypt.hash(dados.senha, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nome, email, papel, criado_em`,
    [dados.nome, dados.email, senhaHash, dados.papel],
  );
  res.status(201).json(rows[0]);
});
