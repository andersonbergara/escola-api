CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  papel       TEXT NOT NULL DEFAULT 'secretaria' CHECK (papel IN ('admin', 'secretaria')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alunos (
  id               SERIAL PRIMARY KEY,
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  telefone         TEXT,
  data_nascimento  DATE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turmas (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  curso      TEXT NOT NULL,
  professor  TEXT NOT NULL,
  horario    TEXT NOT NULL,
  vagas      INTEGER NOT NULL CHECK (vagas > 0),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matriculas (
  id         SERIAL PRIMARY KEY,
  aluno_id   INTEGER NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  turma_id   INTEGER NOT NULL REFERENCES turmas(id) ON DELETE RESTRICT,
  status     TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, turma_id)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON matriculas (turma_id) WHERE status = 'ativa';
