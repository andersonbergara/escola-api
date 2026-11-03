import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: isTest
    ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
    : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || (isTest ? 'segredo-de-teste' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL não definida. Copie .env.example para .env e ajuste os valores.');
}
if (!config.jwtSecret) {
  throw new Error('JWT_SECRET não definido. Copie .env.example para .env e ajuste os valores.');
}
