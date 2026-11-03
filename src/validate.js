import { z } from 'zod';
import { AppError } from './errors.js';

/** Valida `data` com o schema do zod e lança 400 com os campos inválidos. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensagem: i.message,
    }));
    throw new AppError(400, 'Dados inválidos.', details);
  }
  return result.data;
}

export const idParam = z.coerce.number().int().positive();

export const paginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
