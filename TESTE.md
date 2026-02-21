# Como testar o core backend

## 1. Preparar o ambiente

```bash
cd /var/www/core   # ou o caminho do projeto
npm install
cp .env.example .env
```

Edite o `.env` e preencha:

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (do projeto Supabase)
- `JWT_SECRET` (o mesmo que o Supabase usa: em Settings > API > JWT Secret)

Opcional para webhook: `STRIPE_WEBHOOK_SECRET`.

## 2. Subir o servidor

```bash
npm run dev
```

Deve aparecer: `Core backend rodando em http://localhost:3000`

## 3. Testar sem autenticação

**Health check:**

```bash
curl http://localhost:3000/health
```

Resposta esperada: `{"status":"ok","service":"core-backend-seguranca"}`

## 4. Testar rotas que exigem token

As rotas `/api/*` exigem o header `Authorization: Bearer <token>`.

### Opção A: Token do Supabase

Se você tem um projeto Supabase com Auth:

1. Faça login (pela sua app ou pelo Supabase Dashboard > Authentication).
2. Pegue o **access_token** da sessão (no frontend: `session.access_token`).
3. No Supabase, o JWT precisa ter `account_id` (ex.: em **app_metadata**). Se ainda não tiver, cadastre em **Authentication > Users > User** em "Raw User Meta Data" ou via SQL/trigger.
4. Teste:

```bash
curl -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" http://localhost:3000/api/example
```

### Opção B: Token de teste (jwt.io)

Para testar sem Supabase:

1. Acesse https://jwt.io
2. No payload, use algo como:
   ```json
   {
     "sub": "user-123",
     "account_id": "550e8400-e29b-41d4-a716-446655440000",
     "role": "admin"
   }
   ```
3. Em "Verify Signature" use o **mesmo valor** que está no `JWT_SECRET` do seu `.env`.
4. Copie o token gerado e use:

```bash
curl -H "Authorization: Bearer COLE_O_TOKEN_AQUI" http://localhost:3000/api/example
```

Se a tabela `example_table` existir no Supabase e tiver dados para esse `account_id`, a API retorna a lista. Caso contrário pode retornar `[]` ou erro de tabela.

### Rota só para admin

```bash
curl -H "Authorization: Bearer TOKEN_COM_ROLE_ADMIN" http://localhost:3000/api/audit
```

Com token sem role `admin` ou `super_admin`: resposta 403.

## 5. Testar webhook Stripe (opcional)

O Stripe envia assinatura no header. Para simular:

- Use o **Stripe CLI**: `stripe listen --forward-to localhost:3000/webhooks/stripe` e dispare um evento de teste.
- Ou no Dashboard Stripe > Webhooks, adicione o endpoint (URL pública) e use "Send test webhook".

Sem a assinatura correta, a API retorna 401.

## 6. Resumo rápido

| O que testar        | Comando / ação |
|---------------------|----------------|
| Servidor no ar      | `curl http://localhost:3000/health` |
| API com token       | `curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/example` |
| API sem token       | Deve retornar 401 |
| Sanitização         | Enviar `account_id` no body ou query: o backend ignora e usa só o do token |
| Webhook             | Stripe CLI ou teste pelo Dashboard Stripe |
