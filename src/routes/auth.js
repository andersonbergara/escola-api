import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { parse } from '../validate.js';
import { autenticar, exigirPapel } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  senha: z.string().min(1),
});

const registrarSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  papel: z.enum(['admin', 'secretaria']).default('secretaria'),
});

authRouter.post('/login', async (req, res) => {
  const { email, senha } = parse(loginSchema, req.body);
  const { rows } = await query('SELECT id, nome, senha_hash, papel FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];
  // Mesma resposta para e-mail inexistente e senha errada, para não revelar quais e-mails existem.
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    throw new AppError(401, 'E-mail ou senha incorretos.');
  }
  const token = jwt.sign({ papel: usuario.papel }, config.jwtSecret, {
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
