import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
const issuer = process.env.JWT_ISSUER || 'supabase';

/**
 * Middleware de autenticação.
 * Valida o Bearer token e extrai account_id, user_id (sub) e role.
 * NUNCA ler account_id do body/query — só do token.
 */
export function authMiddleware(req, res, next) {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente ou inválido' });
  }

  const token = raw.slice(7);
  let payload;

  try {
    payload = jwt.verify(token, secret, { issuer });
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // Claims: sub = user id, account_id e role devem vir no JWT (Supabase custom claims ou seu IdP)
  req.userId = payload.sub;
  // account_id pode vir em app_metadata (Supabase) ou no payload direto
  req.accountId = payload.account_id ?? payload.app_metadata?.account_id;
  req.role = payload.role ?? payload.app_metadata?.role ?? 'user';

  if (!req.accountId) {
    return res.status(401).json({ error: 'Token sem account_id' });
  }

  next();
}
