/**
 * Gera um JWT de teste para chamar as rotas /api/* do core.
 * Usa o JWT_SECRET e JWT_ISSUER do .env (rode a partir da raiz do core: node scripts/generate-test-token.js).
 * O core vai validar o token; se sub não existir no banco, resolve como consumer (accountId null).
 * Rotas que não filtram por conta (ex.: subscription_plans, platform_config) retornam 200.
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
const issuer = process.env.JWT_ISSUER || 'supabase';

if (!secret) {
  console.error('JWT_SECRET não definido no .env');
  process.exit(1);
}

const payload = {
  sub: '00000000-0000-0000-0000-000000000001', // user id de teste
};

const token = jwt.sign(payload, secret, { expiresIn: '1h', issuer });
console.log('Token de teste (use no curl com -H "Authorization: Bearer <token>"):\n');
console.log(token);
console.log('\nExemplo:');
console.log(`curl -s -H "Authorization: Bearer ${token}" http://localhost:3000/api/subscription_plans`);
