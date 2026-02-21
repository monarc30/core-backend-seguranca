# Antes de enviar ao cliente

Checklist para você (prestador) e o que o cliente precisa fazer após receber o repositório.

---

## O que você deve fazer antes de enviar

- [ ] **Não commitar `.env`** — Garantir que `.env` (raiz e `php/.env`) estejam no `.gitignore` e nunca tenham sido commitados com chaves reais.
- [ ] **Remover chaves de teste** — Se usou `.env` local com valores de teste, apagar o arquivo ou deixar só `.env.example` no repo.
- [ ] **Definir qual versão entregar** — Se a cliente escolheu Node ou PHP, pode remover a outra pasta antes do push (ou deixar as duas e informar qual usar). Opcional.
- [ ] **Revisar README e DOCUMENTACAO_TECNICA.md** — Confirmar que URLs e nomes de exemplo estão genéricos (sem dados reais da cliente).
- [ ] **Push no repositório do contratante** — Entregar no Git conforme combinado (branch ou repo que eles indicarem).

---

## O que o cliente precisa fazer após receber

1. **Clonar/aceder ao repositório** e definir ambiente de deploy (servidor, Vercel, Railway, etc.).
2. **Criar/obter variáveis de ambiente** (Supabase URL e service_role dos 3 projetos, JWT secret, segredo do webhook Stripe) e configurá-las no ambiente de deploy. Não commitar esses valores.
3. **Executar o SQL** em `sql/001_tables.sql` em cada um dos 3 projetos Supabase (webhook_events_processed, audit_logs).
4. **Garantir JWT com `account_id`** no Supabase Auth (app_metadata ou custom claims) para que o core identifique o tenant.
5. **Escolher Node ou PHP** e seguir as instruções de instalação no README (e em `php/README.md` se for PHP).
6. **Integrar as 3 aplicações React** — Substituir chamadas diretas ao Supabase nas operações críticas por chamadas à API do core (ver DOCUMENTACAO_TECNICA.md, seção 6).
7. **Configurar o webhook no Stripe** (ou outro provedor) apontando para a URL pública do core (ex.: `https://api.seudominio.com/webhooks/stripe`).

---

## Entregáveis (conforme proposta)

| Item | Onde está |
|------|------------|
| Código-fonte completo e documentado | Repositório (Node em `src/`, PHP em `php/`) |
| Estrutura organizada e padronizada | README, php/README.md |
| Configuração de deploy | README (Deploy), DOCUMENTACAO_TECNICA.md (seção 5) |
| Documentação técnica completa | **DOCUMENTACAO_TECNICA.md** (endpoints, auth, variáveis, webhook, instalação) |
| Análise e respostas ao cliente | **ANALISE_PROJETO_CORE_BACKEND_SEGURANCA.md** |
| SQL das tabelas | **sql/001_tables.sql** |

Quando tudo estiver ok no checklist acima, o pacote está pronto para envio.
