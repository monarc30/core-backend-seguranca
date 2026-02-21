# Análise do Projeto: Core Backend de Segurança Multi-Tenant

> Documento técnico completo para análise de viabilidade e respostas às perguntas do cliente.  
> **Data:** 15/02/2025  
> **Status:** Viável

---

## Sumário

1. [Resumo Executivo](#1-resumo-executivo)
2. [Escopo do Projeto](#2-escopo-do-projeto)
3. [Arquitetura Proposta](#3-arquitetura-proposta)
4. [Respostas às Perguntas do Cliente](#4-respostas-às-perguntas-do-cliente)
5. [Especificações Técnicas](#5-especificações-técnicas)
6. [Entregáveis e Cronograma](#6-entregáveis-e-cronograma)
7. [Pontos de Atenção e Recomendações](#7-pontos-de-atenção-e-recomendações)

---

## 1. Resumo Executivo

### Viabilidade

**O projeto é VIÁVEL.** O escopo é técnico e bem delimitado, com padrões conhecidos e repetíveis. As perguntas do cliente demonstram maturidade técnica e devem ser respondidas detalhadamente para estabelecer confiança e alinhamento.

### Objetivo Geral

Criar um **core backend de segurança reutilizável** que atue como camada intermediária entre o frontend das aplicações SaaS e o banco de dados (Supabase), garantindo:

- Isolamento multi-tenant obrigatório
- Validação de autenticação em todas as requisições
- Controle de planos exclusivamente via eventos de pagamento confirmados
- Webhooks seguros com idempotência
- Auditoria detalhada de ações críticas
- Zero exposição de chaves administrativas no frontend

---

## 2. Escopo do Projeto

### 2.0 Contexto das Plataformas (escopo cristalino)

**São 3 SaaS independentes**, cada um com:

- sua **própria aplicação** (frontend + código específico do produto);
- seu **próprio projeto no Supabase** (banco, Auth, RLS separados).

A ideia é **integrar o mesmo core de segurança nos três**. O core atua como camada intermediária única (ou instância por app, conforme decisão de deploy), mas cada SaaS continua com seu projeto Supabase próprio — não há banco compartilhado entre os 3 produtos.

| SaaS | Aplicação | Projeto Supabase |
|------|-----------|------------------|
| 1 | App A | Projeto Supabase A |
| 2 | App B | Projeto Supabase B |
| 3 | App C | Projeto Supabase C |

Isso evita interpretação de “uma aplicação com 3 módulos” ou “um único banco para os 3”: são **3 aplicações distintas, 3 projetos Supabase distintos**, com um **core de segurança reutilizável** integrado em cada uma.

### 2.1 Desenvolvimento do Backend Intermediário

- Camada entre frontend e Supabase
- Todas as operações sensíveis passam pelo backend
- Nenhuma chamada direta do frontend a operações críticas do banco

### 2.2 Autenticação e Autorização

- Validação de token em todas as requisições
- Extração de `account_id` e `role` exclusivamente do token JWT
- Controle de roles (admin, usuário, viewer)

### 2.3 Isolamento Multi-Tenant

- Checagem obrigatória de `account_id` em rotas sensíveis
- Nunca confiar em `account_id` vindo do frontend
- Prevenção de acesso cruzado entre contas

### 2.4 Controle de Planos e Assinaturas

- Alterações de plano apenas via eventos confirmados de pagamento (webhooks)
- Impossibilidade de alteração via frontend ou API direta
- Validação de assinatura em webhooks
- Mecanismo de idempotência para evitar processamento duplicado

### 2.5 Segurança e Auditoria

- Chaves administrativas estritamente no backend
- Logs de auditoria para: alterações de plano, eventos de faturamento, ações administrativas
- Rejeição de webhooks inválidos

### 2.6 Integração e Testes

- Integração nas três plataformas SaaS existentes
- Testes de isolamento entre usuários e empresas
- Teste de rejeição de alteração de plano via frontend
- Validação de rejeição de webhooks inválidos

### 2.7 Entregáveis

- Código-fonte completo e documentado
- Configuração de deploy em ambiente definido em conjunto
- Documentação técnica abrangente (endpoints, variáveis de ambiente, instruções)

### 2.8 Critérios de Conclusão

O projeto será concluído somente após validação de que:

- Não há acesso cruzado entre contas
- Planos não podem ser alterados sem confirmação real de pagamento
- Nenhuma chave administrativa está exposta no frontend

---

## 3. Arquitetura Proposta

```
  App A (SaaS 1)     App B (SaaS 2)     App C (SaaS 3)
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │ Frontend A  │    │ Frontend B  │    │ Frontend C  │
  │ Token JWT   │    │ Token JWT   │    │ Token JWT   │
  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CORE BACKEND (API Intermediária — reutilizável)             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │ Auth        │  │ Tenant       │  │ Role        │  │ Webhook      │   │
│  │ Middleware  │→ │ Middleware   │→ │ Middleware  │→ │ Handler      │   │
│  │ (token)     │  │ (account_id) │  │ (admin/etc) │  │ (idempotência)│   │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘   │
│  • account_id SEMPRE do token, nunca do frontend                        │
│  • Sanitização de body/query antes de handlers                          │
│  • Auditoria de ações críticas                                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Supabase A      │    │ Supabase B      │    │ Supabase C      │
│ (Projeto 1)     │    │ (Projeto 2)     │    │ (Projeto 3)     │
│ RLS + audit_logs│    │ RLS + audit_logs│    │ RLS + audit_logs│
└─────────────────┘    └─────────────────┘    └─────────────────┘
  3 projetos Supabase independentes — um por SaaS
```

---

## 4. Respostas às Perguntas do Cliente

### 4.1 Arquitetura Multi-Tenant com Supabase e RLS

> **Pergunta:** Você já implementou arquitetura multi-tenant real com Supabase utilizando account_id obrigatório em todas as tabelas sensíveis e revisão de RLS? Pode explicar como garantiria que nenhuma rota permita acesso cruzado mesmo em caso de erro no frontend?

**Resposta:**

Sim. A abordagem inclui:

- **account_id obrigatório:** Todas as tabelas sensíveis terão `account_id UUID NOT NULL` com `FOREIGN KEY` e índice apropriado.
- **RLS em todas as tabelas sensíveis:** Políticas que filtram por `account_id = auth.jwt() ->> 'account_id'` (ou equivalente conforme estratégia de JWT).
- **Revisão sistemática:** Checklist de tabelas sensíveis com verificação de RLS ativo e constraints.
- **Testes automatizados:** Para cada tabela sensível, testes que tentam acesso com `account_id` de outro tenant e validam rejeição.

A garantia contra acesso cruzado **não depende do frontend**. O backend extrai `account_id` exclusivamente do token JWT validado e usa esse valor em todas as queries. Mesmo que o frontend envie `account_id` incorreto ou malicioso, ele é descartado e sobrescrito pelo valor do token. O banco, por sua vez, filtra por esse mesmo `account_id` (via backend e/ou RLS). O frontend nunca tem poder de decisão sobre qual conta está sendo acessada.

---

### 4.2 Middleware de Validação e account_id do Frontend

> **Pergunta:** Como você estruturaria o middleware de validação para garantir que nenhuma rota permita uso de account_id vindo do frontend?

**Resposta:**

**Princípio:** O middleware **nunca lê** `account_id` de body, query ou params. Ele **sempre extrai** do token JWT validado.

**Arquitetura sugerida:**

```typescript
// 1. Middleware de autenticação (primeiro na cadeia)
const authMiddleware = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  const payload = validateAndDecodeJWT(token);
  req.accountId = payload.account_id;  // ÚNICA fonte de account_id
  req.userId = payload.sub;
  req.role = payload.role;
  next();
};

// 2. Middleware de sanitização (antes dos handlers)
const sanitizeRequest = (req, res, next) => {
  delete req.body?.account_id;
  delete req.query?.account_id;
  delete req.params?.account_id;
  // Garantir que account_id só existe em req.accountId (do token)
  next();
};

// 3. Handlers usam SOMENTE req.accountId
const getSensitiveData = async (req, res) => {
  const rows = await db
    .from('sensitive_table')
    .select('*')
    .eq('account_id', req.accountId);  // Sempre do token
  return res.json(rows);
};
```

**Regras de implementação:**

| Regra | Descrição |
|-------|-----------|
| R1 | Nunca ler `account_id` de `req.body`, `req.query` ou `req.params` |
| R2 | Sempre extrair `account_id` do JWT validado no middleware de auth |
| R3 | Sanitizar body/query/params removendo `account_id` antes de qualquer lógica |
| R4 | Todas as queries usam `req.accountId` como parâmetro |
| R5 | Documentar e reforçar em code review |

---

### 4.3 Proteção com Tabela sem RLS

> **Pergunta:** Se por erro uma tabela estiver sem RLS ativa, o backend ainda impede acesso cruzado? Como?

**Resposta:**

Sim. O isolamento possui **duas camadas**:

| Camada | Responsabilidade | Redundância |
|--------|------------------|-------------|
| **Backend** | Todas as queries filtram por `account_id` extraído do token | Primária |
| **Banco (RLS)** | Políticas adicionais como segunda linha de defesa | Complementar |

Se uma tabela estiver sem RLS por erro de configuração:

- O backend continua filtrando por `account_id` em todas as queries.
- As queries são construídas no código, nunca usando valores arbitrários vindos do cliente.
- O acesso cruzado permanece bloqueado pela camada backend.

RLS sem backend ainda pode vazar se o frontend acessar o banco diretamente. **Backend sem RLS ainda protege** desde que o backend seja o único ponto de acesso ao banco para operações sensíveis. RLS é camada extra de segurança, não a única.

---

### 4.4 Armazenamento do event_id para Idempotência

> **Pergunta:** Onde você armazenará o event_id para garantir idempotência de webhooks?

**Resposta:**

Em uma **tabela dedicada no banco de dados**:

```sql
CREATE TABLE webhook_events_processed (
  event_id     TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,           -- 'stripe', 'paddle', etc.
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT,                    -- opcional: detectar alterações
  outcome      TEXT                     -- 'success', 'skipped', 'error'
);

CREATE INDEX idx_webhook_events_provider ON webhook_events_processed(provider, processed_at);
```

**Fluxo de idempotência:**

1. Webhook recebido → extrair `event_id` do payload.
2. Tentar inserir:  
   `INSERT INTO webhook_events_processed (event_id, provider, outcome) VALUES ($1, $2, 'processing') ON CONFLICT (event_id) DO NOTHING RETURNING *`
3. Se a inserção retornar linha → evento novo → processar o webhook.
4. Se a inserção não retornar linha → evento já processado → retornar `200 OK` sem reprocessar.
5. Após processar, atualizar `outcome` para `'success'` ou `'error'`.

A constraint `PRIMARY KEY` em `event_id` garante unicidade e evita duplicidade de processamento.

---

### 4.5 Estrutura da Auditoria

> **Pergunta:** A auditoria será em tabela própria no banco? Qual estrutura você sugere?

**Resposta:**

Sim, em **tabela própria**:

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  account_id    UUID NOT NULL,
  user_id       UUID,
  action        TEXT NOT NULL,          -- 'plan_change', 'billing_event', 'admin_action'
  resource_type TEXT,                   -- 'subscription', 'invoice', 'user'
  resource_id   TEXT,
  old_value     JSONB,
  new_value     JSONB,
  metadata      JSONB,                  -- IP, user_agent, request_id
  performed_by  UUID
);

CREATE INDEX idx_audit_account_created ON audit_logs(account_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

**Campos principais:**

| Campo | Descrição |
|-------|-----------|
| `action` | Tipo da ação (ex: `plan_change`, `billing_event`, `admin_action`) |
| `resource_type` | Entidade afetada (ex: `subscription`, `invoice`) |
| `resource_id` | ID do recurso alterado |
| `old_value` / `new_value` | Snapshot antes/depois (para auditoria forense) |
| `metadata` | IP, user_agent, request_id para rastreabilidade |

**Alternativa:** Usar extensions como `pg_audit` ou logs externos (Datadog, Logtail) se preferir separação de armazenamento.

---

### 4.6 Controle de Roles

> **Pergunta:** Você implementará controle de roles (ex: admin vs usuário comum) no backend?

**Resposta:**

Sim. Estrutura sugerida:

- **Claims no JWT:** Incluir `role` (ex: `admin`, `user`, `viewer`) no token emitido no login.
- **Middleware de roles:** Antes de rotas sensíveis, verificar `req.role`.
- **Matriz de permissões:**
  - `admin` (da conta): alterar configurações da conta, ver logs de auditoria, gerenciar usuários da conta.
  - `user`: operações normais dentro do escopo da conta.
  - `viewer`: apenas leitura.
- Rotas administrativas (ex: alteração de plano, billing, configurações) restritas a `admin` ou `super_admin` conforme necessário.

**Exemplo de middleware:**

```typescript
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Uso
router.get('/admin/settings', requireRole('admin', 'super_admin'), getSettings);
```

---

### 4.7 Deploy e Variáveis de Ambiente

> **Pergunta:** O deploy e as variáveis de ambiente ficarão 100% sob minha conta?

**Resposta:**

Sim. O contratado:

- Entrega código e documentação.
- Documenta todas as variáveis de ambiente necessárias (sem valores reais).
- Fornece `.env.example` e instruções de deploy (ex: Docker, docker-compose).
- **Não** cria contas em provedores ou armazena variáveis sensíveis.

O cliente mantém controle total de:

- Ambiente de deploy (Vercel, Railway, Render, AWS, etc.)
- Variáveis de ambiente e segredos
- Credenciais do Supabase
- Chaves de webhooks (Stripe, Paddle, etc.)

Opcionalmente, uma sessão de configuração inicial pode ser acordada para auxiliar na primeira implantação.

---

### 4.8 Prazo de Entrega

> **Pergunta:** Você consegue estruturar uma primeira entrega funcional em até 15 dias, mantendo o prazo final de 25?

**Resposta:**

Sim, com o seguinte cronograma:

**Entrega 1 (até 15 dias):**

- Core backend funcional com autenticação via token
- Middleware multi-tenant + sanitização de `account_id`
- Conjunto de endpoints principais de uma aplicação piloto
- Webhook seguro com validação de assinatura e idempotência
- Estrutura de auditoria implementada
- Documentação inicial e instruções de deploy

**Entrega 2 (até 25 dias):**

- Integração completa nas três aplicações SaaS
- Testes de isolamento entre tenants
- Testes de rejeição de alteração de plano via frontend
- RLS revisado/implementado em tabelas sensíveis
- Documentação técnica completa
- Configuração de deploy final validada

**Pré-requisitos para cumprir o prazo:**

- Acesso ao código das três aplicações
- Definição do provedor de pagamento (Stripe, Paddle, etc.)
- Definição do ambiente de deploy
- Disponibilidade para alinhamentos rápidos em caso de dúvidas

---

## 5. Especificações Técnicas

### 5.1 Stack Sugerida

| Componente | Tecnologia |
|------------|------------|
| Runtime | Node.js 20+ |
| Framework | Express ou Fastify |
| Banco | Supabase (PostgreSQL) |
| Autenticação | JWT (Supabase Auth ou custom) |
| Deploy | A definir (Vercel, Railway, Render, etc.) |
| Testes | Vitest ou Jest + Supertest |

### 5.2 Variáveis de Ambiente

Como são **3 projetos Supabase** (um por SaaS), o backend precisará de uma URL e uma `service_role` por projeto — por exemplo via prefixo por app (`SUPABASE_URL_APP_A`, `SUPABASE_URL_APP_B`, `SUPABASE_URL_APP_C`) ou configuração por tenant/origem. Definir em conjunto na implementação.

```env
# Supabase (exemplo: um conjunto por projeto; ou config dinâmica por app)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# JWT
JWT_SECRET=
JWT_ISSUER=

# Webhooks
STRIPE_WEBHOOK_SECRET=
PADDLE_WEBHOOK_PUBLIC_KEY=

# Auditoria
AUDIT_LOG_ENABLED=true
```

### 5.3 Endpoints Principais

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/api/:resource` | Listar recursos do tenant | Token + account_id |
| GET | `/api/:resource/:id` | Obter recurso por ID | Token + account_id |
| POST | `/api/:resource` | Criar recurso | Token + account_id |
| PATCH | `/api/:resource/:id` | Atualizar recurso | Token + account_id |
| DELETE | `/api/:resource/:id` | Remover recurso | Token + account_id |
| POST | `/webhooks/stripe` | Webhook Stripe | Assinatura |
| POST | `/webhooks/paddle` | Webhook Paddle | Assinatura |
| GET | `/admin/audit` | Logs de auditoria | Token + role admin |

### 5.4 Modelo de Dados para Idempotência e Auditoria

- **webhook_events_processed:** Conforme seção 4.4
- **audit_logs:** Conforme seção 4.5
- **Tabelas sensíveis:** Todas com `account_id UUID NOT NULL` e RLS quando possível

---

## 6. Entregáveis e Cronograma

| Entrega | Prazo | Conteúdo |
|---------|-------|----------|
| **M1** | 15 dias | Core backend, auth, middleware multi-tenant, webhook, auditoria, docs iniciais |
| **M2** | 25 dias | Integração nas 3 apps, testes de isolamento, validações finais, docs completas, deploy |

### Checklist de Validação Final

- [ ] Não há acesso cruzado entre contas
- [ ] Planos não podem ser alterados sem confirmação de pagamento
- [ ] Nenhuma chave administrativa exposta no frontend
- [ ] Webhooks inválidos são rejeitados
- [ ] Tentativa de alteração de plano via frontend é rejeitada
- [ ] Logs de auditoria registram ações críticas
- [ ] Documentação técnica e de deploy concluídas

---

## 7. Pontos de Atenção e Recomendações

### 7.1 Antes do Início

| Item | Ação |
|------|------|
| Ambiente de deploy | Definir plataforma e conta |
| Provedor de pagamento | Stripe, Paddle ou outro |
| Acesso às 3 aplicações | Garantir acesso de leitura e deploy (cada uma é um SaaS independente) |
| Supabase | Acesso aos **3 projetos Supabase** (um por SaaS), com permissões adequadas em cada um |

### 7.2 Durante o Projeto

| Item | Recomendação |
|------|--------------|
| Code review | Foco em queries e uso de `account_id` |
| Testes | Automatizar testes de isolamento |
| Documentação | Atualizar junto com o código |
| Comunicação | Alinhamentos curtos e frequentes |

### 7.3 Contrato

| Item | Recomendação |
|------|--------------|
| Critérios de aceitação | Especificar em checklist executável |
| Responsabilidades | Definir backend vs RLS no documento |
| Escopo fixo | Evitar alterações de escopo sem renegociação de prazo/custo |
| Repositório | Garantir acesso ao Git do cliente para entregas |

---

## Anexo: Exemplo de Fluxo Completo

```
1. Usuário faz login → Supabase Auth emite JWT com claims: { sub, account_id, role }
2. Frontend armazena token e envia em todas as requisições: Authorization: Bearer <token>
3. Backend recebe GET /api/projects
   → authMiddleware: valida token, extrai account_id, user_id, role
   → sanitizeRequest: remove account_id de body/query
   → handler: SELECT * FROM projects WHERE account_id = req.accountId
4. Tentativa maliciosa: frontend envia GET /api/projects?account_id=outro-uuid
   → sanitizeRequest: remove account_id da query
   → handler: usa req.accountId (do token) → isolamento preservado
5. Webhook Stripe recebido
   → valida assinatura
   → INSERT em webhook_events_processed ON CONFLICT DO NOTHING
   → se inseriu: processa evento, atualiza assinatura
   → se não inseriu: retorna 200 (idempotência)
6. Ação administrativa
   → requireRole('admin')
   → executa ação
   → INSERT em audit_logs
```

---

*Documento gerado para análise de viabilidade e suporte à proposta técnica do projeto Core Backend de Segurança.*
