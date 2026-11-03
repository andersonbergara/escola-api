# Escola API

[![CI](https://github.com/andersonbergara/escola-api/actions/workflows/ci.yml/badge.svg)](https://github.com/andersonbergara/escola-api/actions/workflows/ci.yml)

API REST para gestão de uma escola de cursos: cadastro de alunos, turmas com controle de vagas e matrículas. O projeto foi inspirado em um problema real de secretaria escolar e construído com foco em boas práticas de backend: validação, autenticação, controle de acesso, testes automatizados e execução com Docker.

## Funcionalidades

- Autenticação com JWT e dois perfis de acesso: `admin` e `secretaria`.
- CRUD de alunos, com busca por nome ou e-mail e paginação.
- CRUD de turmas, com cálculo automático de vagas ocupadas e livres.
- Matrículas com regras de negócio: sem duplicidade, sem ultrapassar o limite de vagas e com reativação de matrículas canceladas.
- Validação de entrada com respostas de erro padronizadas e detalhadas por campo.
- Documentação OpenAPI em [`docs/openapi.yaml`](docs/openapi.yaml).

## Tecnologias

Node.js 22, Express 5, PostgreSQL 16, JWT (`jsonwebtoken`), `bcryptjs`, Zod, Docker e Docker Compose, GitHub Actions e o test runner nativo do Node (`node:test`).

## Como executar

### Com Docker (recomendado)

```bash
git clone https://github.com/andersonbergara/escola-api.git
cd escola-api
docker compose up --build
```

A API sobe em `http://localhost:3000`, com o banco criado e um administrador inicial (`admin@exemplo.com` / `admin12345`). Para uso real, defina `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_SENHA` em um arquivo `.env`.

### Sem Docker

Requer Node.js 20+ e um PostgreSQL acessível.

```bash
npm install
cp .env.example .env     # ajuste DATABASE_URL, JWT_SECRET e dados do admin
npm run migrate          # cria as tabelas
npm run seed             # cria o primeiro administrador
npm start
```

## Testes

Os testes são de integração e rodam contra um PostgreSQL real, usando o banco indicado em `DATABASE_URL_TEST`.

```bash
DATABASE_URL_TEST=postgres://usuario:senha@localhost:5432/escola_test npm test
```

A suíte cobre autenticação, permissões, validação, paginação, regras de matrícula e um cenário de concorrência em que várias matrículas simultâneas disputam a última vaga. O mesmo comando roda automaticamente no GitHub Actions a cada push.

## Exemplo de uso

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@exemplo.com","senha":"admin12345"}'

# 2. Use o token retornado nas demais requisições
TOKEN=<cole-o-token-aqui>

curl -X POST http://localhost:3000/alunos \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nome":"Ana Souza","email":"ana@exemplo.com"}'

curl -X POST http://localhost:3000/turmas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nome":"Inglês Básico A","curso":"Inglês","professor":"Maria","horario":"Seg e Qua 19h","vagas":15}'

curl -X POST http://localhost:3000/matriculas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"aluno_id":1,"turma_id":1}'
```

## Endpoints

| Método | Rota | Descrição | Acesso |
| --- | --- | --- | --- |
| GET | `/saude` | Verifica API e banco | Público |
| POST | `/auth/login` | Autentica e retorna o token | Público |
| POST | `/auth/registrar` | Cria um usuário | Admin |
| GET, POST | `/alunos` | Lista e cadastra alunos | Autenticado |
| GET, PUT | `/alunos/:id` | Consulta e atualiza um aluno | Autenticado |
| DELETE | `/alunos/:id` | Exclui um aluno | Admin |
| GET, POST | `/turmas` | Lista e cria turmas | Autenticado |
| GET, PUT | `/turmas/:id` | Consulta e atualiza uma turma | Autenticado |
| DELETE | `/turmas/:id` | Exclui uma turma | Admin |
| GET, POST | `/matriculas` | Lista (filtros `aluno_id`, `turma_id`, `status`) e cria matrículas | Autenticado |
| PATCH | `/matriculas/:id/cancelar` | Cancela e libera a vaga | Autenticado |

## Decisões técnicas

- **Vagas sem corrida:** ao matricular, a linha da turma é travada com `SELECT ... FOR UPDATE` dentro de uma transação. Assim, duas requisições simultâneas nunca ocupam a mesma última vaga.
- **Integridade no banco:** chaves estrangeiras, `UNIQUE (aluno_id, turma_id)` e `CHECK` garantem as regras mesmo fora da API. Violações viram respostas HTTP claras (409).
- **Segurança:** senhas com hash bcrypt, mesma mensagem de erro para e-mail inexistente e senha errada, perfis de acesso por rota e variáveis sensíveis fora do código.
- **Erros padronizados:** toda falha devolve `{ "erro": "...", "detalhes": [...] }`.

## Próximos passos

- Controle de mensalidades e pagamentos.
- Relatórios (ocupação das turmas, evasão).
- Frontend para a secretaria.

## Licença

Distribuído sob a licença MIT.
