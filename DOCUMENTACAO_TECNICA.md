# Documentação Técnica — Core Backend de Segurança

Documento único de referência para integração, deploy e operação. Atende ao entregável "Documentação técnica completa" da proposta.

---

## 1. Endpoints da API

Base URL: a definida no deploy (ex.: `https://api.seudominio.com` ou `https://seudominio.com/core`).

| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| GET | `/health` | Nenhuma | Health check. Retorno: `{"status":"ok","service":"..."}`. |
| POST | `/webhooks/stripe` | Assinatura Stripe (header `Stripe-Signature`) | Recebe eventos do Stripe. Valida assinatura, garante idempotência por `event.id`, rejeita duplicados. Retorna 200 mesmo para evento já processado. |
| GET | `/api/example` | Bearer JWT obrigatório | Lista registros da tabela de exemplo filtrados pelo `account_id` do token. |
| POST | `/api/example` | Bearer JWT obrigatório | Cria registro; `account_id` é injetado pelo backend (ignora valor do body). Grava auditoria. |
| GET | `/api/audit` | Bearer JWT + role `admin` ou `super_admin` | Lista últimos 100 logs de auditoria da conta. |

**Observação:** As rotas `/api/example` são exemplos. Na integração real, substitua por seus recursos (ex.: `/api/projects`, `/api/subscriptions`) mantendo a mesma regra: sempre usar `account_id` extraído do token.

---

## 2. Regras de autenticação

- **Rotas `/api/*`:** exigem header `Authorization: Bearer <token>`. O token deve ser JWT válido (emitido pelo Supabase Auth ou pelo IdP combinado).
- **Claims obrigatórios no JWT:** `sub` (user id), `account_id` (identificador da conta/tenant). Opcional: `role` (ex.: `admin`, `user`, `viewer`). O backend **nunca** usa `account_id` enviado no body ou na query; apenas o valor presente no token.
- **Sanitização:** Em todas as rotas protegidas, o backend remove qualquer campo `account_id` do body e da query antes de processar.
- **Webhook Stripe:** não usa Bearer. A autenticação é feita pela verificação da assinatura no header `Stripe-Signature` usando o segredo configurado (`STRIPE_WEBHOOK_SECRET`).

---

## 3. Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`). Para 3 projetos, definir conjunto por app ou config dinâmica. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave **service_role** do Supabase. Usar apenas no backend; nunca no frontend. |
| `JWT_SECRET` | Sim | Segredo para validar o JWT (ex.: JWT Secret do Supabase em Settings > API). |
| `JWT_ISSUER` | Não | Issuer esperado no token (default: `supabase`). |
| `STRIPE_WEBHOOK_SECRET` | Para webhook | Valor `whsec_...` do endpoint de webhook no Dashboard Stripe. |
| `AUDIT_LOG_ENABLED` | Não | `true` ou `false` (default: true). Desativa gravação em `audit_logs` se `false`. |
| `PORT` | Não | Porta do servidor (default: 3000) |

Arquivo de exemplo: `.env.example` na raiz do projeto. Nunca commitar `.env` com valores reais.

---

## 4. Fluxo do webhook (Stripe)

1. Stripe envia POST para `https://seu-dominio/webhooks/stripe` com o body do evento e o header `Stripe-Signature`.
2. O backend lê o body bruto e valida a assinatura com `STRIPE_WEBHOOK_SECRET` (HMAC SHA-256).
3. Se a assinatura for inválida → resposta **401**.
4. Extrai `event.id` do body. Tenta inserir em `webhook_events_processed` (event_id, provider, outcome).
5. Se a inserção falhar por duplicidade (event_id já existe) → resposta **200** com `{"received":true,"duplicate":true}` (idempotência).
6. Se a inserção for bem-sucedida → processa o evento (ex.: `invoice.paid`, `customer.subscription.updated`) e grava auditoria quando aplicável. Atualiza `outcome` para `success` ou `error`.
7. Resposta **200** com `{"received":true}`.

Eventos tratados por padrão (podem ser estendidos): `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. Para outros tipos, o backend pode apenas registrar o recebimento.

---

## 5. Instalação e configuração

### Node.js

```bash
npm install
cp .env.example .env
# Editar .env com as variáveis da seção 3
npm run dev   # desenvolvimento
npm start     # produção
```

### Supabase (cada um dos 3 projetos)

1. Executar no SQL Editor o conteúdo de `sql/001_tables.sql` (cria `webhook_events_processed` e `audit_logs` e políticas de RLS quando aplicável).
2. Garantir que o JWT do Supabase Auth inclua `account_id` e, se desejar, `role` (ex.: via `app_metadata` ou custom claims).
3. Nas tabelas sensíveis das aplicações: coluna `account_id`, RLS ativo e política por `account_id`.

---

## 6. Integração nas 3 aplicações (frontend React)

1. Manter o login via Supabase Auth; o token retornado deve conter `account_id` (e opcionalmente `role`).
2. Nas operações críticas (dados por conta, plano, billing, etc.), **remover** chamadas diretas ao Supabase (client.from(...)) e substituir por chamadas HTTP à API deste core, por exemplo:
   ```js
   fetch('https://sua-api-core/api/recurso', {
     headers: { 'Authorization': `Bearer ${session.access_token}` }
   })
   ```
3. Não enviar `account_id` no body nem na query; o backend usa o valor do token.
4. Chaves como `service_role` e segredos de webhook permanecem apenas no backend; o frontend usa apenas o token de sessão do usuário.

---

*Documento gerado para entrega ao contratante. Repositório: conforme combinado (Git do contratante).*
