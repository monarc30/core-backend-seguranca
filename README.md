# Core Backend de Segurança Multi-Tenant

Backend intermediário reutilizável para integração com aplicações SaaS que usam Supabase. Garante isolamento por `account_id`, validação de token, webhooks seguros com idempotência e auditoria.

## Requisitos

- Node.js 20+
- Projeto(s) Supabase (PostgreSQL)

## Instalação

```bash
npm install
cp .env.example .env
# Editar .env com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, etc.
```

## Tabelas no Supabase

Executar no SQL Editor do seu projeto Supabase (cada SaaS tem seu próprio projeto):

```bash
# Conteúdo em sql/001_tables.sql
```

Cria:

- `webhook_events_processed` — idempotência de webhooks
- `audit_logs` — auditoria de ações críticas

Para rotas de exemplo que usam `example_table`, crie no Supabase:

```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant" ON example_table FOR ALL USING (account_id = (auth.jwt() ->> 'account_id')::UUID);
```

(Substitua por suas tabelas reais; o importante é sempre `account_id` e RLS.)

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service_role (só no backend) |
| `JWT_SECRET` | Sim | Segredo para validar JWT (ex.: JWT Secret do Supabase) |
| `JWT_ISSUER` | Não | Issuer do token (default: `supabase`) |
| `STRIPE_WEBHOOK_SECRET` | Para webhook | `whsec_...` do Stripe |
| `AUDIT_LOG_ENABLED` | Não | `true`/`false` (default: true) |
| `PORT` | Não | Porta do servidor (default: 3000) |

## Executar

```bash
npm run dev   # desenvolvimento (watch)
npm start     # produção
```

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | Não | Health check |
| POST | `/webhooks/stripe` | Assinatura | Webhook Stripe (idempotente) |
| GET | `/api/example` | Token | Lista recursos do tenant |
| POST | `/api/example` | Token | Cria recurso + auditoria |
| GET | `/api/audit` | Token + role admin | Lista logs de auditoria da conta |

## Uso no frontend (3 SaaS)

1. **Login** via Supabase Auth (ou seu IdP). Garantir que o JWT inclua `account_id` e `role` (ex.: em `app_metadata` no Supabase).
2. **Chamar a API** com o token no header:
   ```http
   Authorization: Bearer <token>
   ```
3. **Nunca** enviar `account_id` em body ou query; o backend usa apenas o valor do token.
4. Remover chamadas diretas ao Supabase nas operações críticas e substituir por chamadas a este backend.

## Middlewares

- **auth** — Valida Bearer JWT e define `req.accountId`, `req.userId`, `req.role`.
- **sanitize** — Remove `account_id` de body/query/params.
- **requireRole('admin', ...)** — Restringe rota por role.

Todas as rotas em `/api` passam por auth + sanitize. Rotas sensíveis usam `requireRole()`.

## Deploy

- Configurar variáveis de ambiente no provedor (Vercel, Railway, Render, etc.).
- Para webhook Stripe, usar a URL pública: `https://seu-dominio.com/webhooks/stripe`.
- Manter `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET` apenas no servidor; nunca no frontend.

## Licença

Uso interno / conforme contrato.
