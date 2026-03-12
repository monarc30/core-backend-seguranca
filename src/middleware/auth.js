import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import { resolveAccountFromUser } from '../lib/resolveAccount.js';

const secret = process.env.JWT_SECRET;
const issuer = process.env.JWT_ISSUER || 'supabase';

/**
 * Middleware de autenticação.
 * Valida o Bearer token e extrai account_id, user_id (sub) e role.
 * Se o JWT não trouxer account_id, resolve no banco da app (RPCs has_role, get_user_scd_id, get_user_affiliate_id).
 * NUNCA ler account_id do body/query — só do token ou da resolução.
 */
export async function authMiddleware(req, res, next) {
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

  req.userId = payload.sub;
  req.accountId = payload.account_id ?? payload.app_metadata?.account_id;
  req.role = payload.role ?? payload.app_metadata?.role ?? null;

  if (!req.accountId) {
    try {
      const { accountId, role } = await resolveAccountFromUser(supabase, req.userId);
      req.accountId = accountId;
      req.role = role ?? req.role ?? 'consumer';
    } catch (err) {
      console.error('[auth] resolveAccountFromUser error:', err);
      return res.status(500).json({ error: 'Erro ao resolver conta do usuário' });
    }
  } else if (!req.role) {
    req.role = 'user';
  }

  // scd_user e affiliate precisam ter accountId resolvido; admin e consumer podem ter accountId null
  if (!req.accountId && req.role !== 'admin' && req.role !== 'consumer') {
    return res.status(401).json({ error: 'Token sem account_id' });
  }

  next();
}
