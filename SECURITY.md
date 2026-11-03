# Política de segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use a aba **Security > Report a vulnerability** deste repositório (relato privado do GitHub) ou entre em contato pelo LinkedIn: https://www.linkedin.com/in/andersonbergara

## Medidas implementadas

| Área | Medida |
| --- | --- |
| Autenticação | JWT com algoritmo fixado (HS256), expiração de 8 horas e segredo obrigatório de ao menos 32 caracteres |
| Autorização | O perfil do usuário é consultado no banco a cada requisição: usuário excluído ou rebaixado perde o acesso imediatamente |
| Senhas | Hash bcrypt, tamanho de 10 a 72 caracteres, com letras e números |
| Força bruta | Limite de 10 tentativas de login falhas por IP a cada 15 minutos, e limite geral de requisições por minuto |
| Enumeração de usuários | Mesma mensagem e mesmo tempo de resposta para e-mail inexistente e senha errada |
| Injeção SQL | Consultas parametrizadas; valores numéricos validados antes de entrar em qualquer consulta |
| Entrada | Validação com Zod, corpo limitado a 100 KB, campos desconhecidos descartados |
| Cabeçalhos HTTP | Helmet (nosniff, frame-options, CSP, HSTS, referrer-policy); `X-Powered-By` removido |
| Banco | Porta não publicada no Docker, timeout de consulta e pool de conexões limitado |
| Segredos | Nenhum valor padrão: o Docker Compose e a aplicação se recusam a iniciar sem segredos próprios |
| Testes | Os testes recusam rodar em banco cujo nome não termine em `test`, para nunca apagar dados reais |

## Checklist para colocar em produção

- [ ] Gerar `JWT_SECRET`, `POSTGRES_PASSWORD` e `ADMIN_SENHA` próprios, e nunca reutilizá-los em outros ambientes
- [ ] Servir a API apenas atrás de um proxy reverso com HTTPS e configurar `TRUST_PROXY`
- [ ] Manter o banco sem acesso público e com backups periódicos
- [ ] Ativar Dependabot e a varredura de segredos no repositório
- [ ] Trocar o `JWT_SECRET` imediatamente se houver suspeita de vazamento (isso invalida todos os tokens)

## Limitações conhecidas

- Não há refresh token nem revogação individual de tokens antes do vencimento (mitigado pela checagem do usuário no banco a cada requisição).
- Não há autenticação em dois fatores para os usuários da API.
- O log de auditoria (quem alterou o quê) ainda não foi implementado.
