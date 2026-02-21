import { supabase } from './supabase.js';

const enabled = process.env.AUDIT_LOG_ENABLED !== 'false';

/**
 * Registra ação na tabela audit_logs.
 * Só grava se AUDIT_LOG_ENABLED não for false.
 */
export async function auditLog(entry) {
  if (!enabled) return;

  const row = {
    account_id: entry.accountId,
    user_id: entry.userId ?? null,
    action: entry.action,
    resource_type: entry.resourceType ?? null,
    resource_id: entry.resourceId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
    performed_by: entry.performedBy ?? entry.userId ?? null
  };

  const { error } = await supabase.from('audit_logs').insert(row);
  if (error) {
    console.error('[audit] Erro ao gravar:', error.message);
  }
}

/**
 * Helper para auditoria a partir do req (após auth middleware).
 */
export function auditFromRequest(req) {
  return {
    accountId: req.accountId,
    userId: req.userId,
    performedBy: req.userId,
    metadata: {
      ip: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('user-agent'),
      path: req.path
    }
  };
}
