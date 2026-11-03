import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Consultas que passam de 10 s são interrompidas: protege o banco de abusos.
  statement_timeout: 10_000,
});

export const query = (text, params) => pool.query(text, params);

/** Executa `fn(client)` dentro de uma transação, com commit/rollback automáticos. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
