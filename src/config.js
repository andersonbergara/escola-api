import 'dotenv/config';

const env = process.env.NODE_ENV;
const isTest = env === 'test';

// Segredos de exemplo ou de desenvolvimento que NUNCA podem ser usados de verdade.
const SEGREDOS_PROIBIDOS = new Set([
  'segredo-apenas-para-desenvolvimento',
  'troque-por-um-segredo-longo-e-aleatorio',
  'segredo-de-teste',
  'changeme',
  'secret',
]);

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

// --- Banco de dados ---------------------------------------------------------
// Os testes apagam tabelas. Por isso exigem uma URL própria e recusam qualquer
// banco cujo nome não termine em "test", evitando apagar dados reais por engano.
const databaseUrl = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
exigir(
  databaseUrl,
  isTest
    ? 'DATABASE_URL_TEST não definida. Os testes exigem um banco separado, com nome terminado em "test".'
    : 'DATABASE_URL não definida. Copie .env.example para .env e ajuste os valores.',
);
if (isTest) {
  const nomeDoBanco = new URL(databaseUrl).pathname.replace('/', '');
  exigir(
    nomeDoBanco.endsWith('test'),
    `Recusando rodar testes no banco "${nomeDoBanco}": o nome deve terminar em "test".`,
  );
}

// --- JWT --------------------------------------------------------------------
const jwtSecret = process.env.JWT_SECRET || (isTest ? 'segredo-de-teste' : undefined);
exigir(jwtSecret, 'JWT_SECRET não definido. Gere um com: openssl rand -hex 32');
if (!isTest) {
  exigir(jwtSecret.length >= 32, 'JWT_SECRET muito curto: use ao menos 32 caracteres (openssl rand -hex 32).');
  exigir(!SEGREDOS_PROIBIDOS.has(jwtSecret), 'JWT_SECRET é um valor de exemplo conhecido. Gere um segredo próprio.');
}

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // Quantidade de proxies reversos confiáveis à frente da API (ex.: 1 atrás do Nginx).
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,
  // Limites de requisições: rígido no login, mais folgado no restante.
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT || (isTest ? 1000 : 10)),
  globalRateLimit: Number(process.env.GLOBAL_RATE_LIMIT || (isTest ? 100000 : 300)),
};
