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
cp .env.example .env
```

Edite o `.env` e preencha todos os valores. Não existem senhas ou segredos padrão: se algum estiver faltando, o Docker Compose avisa qual. Para gerar valores fortes:

```bash
openssl rand -hex 32   # use como JWT_SECRET
openssl rand -hex 16   # use como POSTGRES_PASSWORD
```

A senha do administrador (`ADMIN_SENHA`) deve ter de 10 a 72 caracteres, com letras e números. Depois, suba tudo:

```bash
docker compose up --build
```

A API sobe em `http://localhost:3000`, acessível apenas pelo próprio computador. O banco não é exposto. Para publicar na internet, use um proxy reverso com HTTPS (veja [SECURITY.md](SECURITY.md)).

### Sem Docker

Requer Node.js 20+ e um PostgreSQL acessível.

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL, JWT_SECRET (mín. 32 caracteres) e dados do admin
npm run migrate          # cria as tabelas
npm run seed             # cria o primeiro administrador
npm start
```

## Testes

Os testes são de integração e rodam contra um PostgreSQL real, usando o banco indicado em `DATABASE_URL_TEST`. Como eles apagam as tabelas, recusam rodar em qualquer banco cujo nome não termine em `test`.

```bash
DATABASE_URL_TEST=postgres://usuario:senha@localhost:5432/escola_test npm test
```

A suíte (37 testes) cobre autenticação, permissões, validação, paginação, regras de matrícula, segurança (tokens forjados, injeção SQL, limite de tentativas de login) e um cenário de concorrência em que várias matrículas simultâneas disputam a última vaga. O mesmo comando roda automaticamente no GitHub Actions a cada push.

## Exemplo de uso

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"SEU_EMAIL_DE_ADMIN","senha":"SUA_SENHA_DE_ADMIN"}'

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
- **Segurança:** veja a seção abaixo e o arquivo [SECURITY.md](SECURITY.md).
- **Erros padronizados:** toda falha devolve `{ "erro": "...", "detalhes": [...] }`.

## Segurança

- Tokens JWT com algoritmo fixado e perfil do usuário conferido no banco a cada requisição: usuário excluído ou rebaixado perde o acesso na hora.
- Senhas com hash bcrypt e política de 10 a 72 caracteres, com letras e números.
- Limite de tentativas de login por IP (proteção contra força bruta) e limite geral de requisições.
- Mesma mensagem e mesmo tempo de resposta para e-mail inexistente e senha errada.
- Consultas parametrizadas, validação de toda entrada e corpo limitado a 100 KB.
- Cabeçalhos de segurança HTTP com Helmet.
- Nenhum segredo padrão: a aplicação e o Docker Compose se recusam a iniciar sem segredos próprios.
- O banco não é exposto fora da rede interna do Docker.

## Próximos passos

- Controle de mensalidades e pagamentos.
- Refresh token, log de auditoria e autenticação em dois fatores para os usuários da API.
- Relatórios (ocupação das turmas, evasão).
- Frontend para a secretaria.

## Licença

Distribuído sob a licença MIT.
