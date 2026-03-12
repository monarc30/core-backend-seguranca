import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sanitizeRequest } from '../middleware/sanitize.js';
import { requireRole } from '../middleware/roles.js';
import { supabase } from '../lib/supabase.js';
import { auditLog, auditFromRequest } from '../lib/audit.js';

const router = Router();

// Todas as rotas exigem auth + sanitização (account_id só do token)
router.use(authMiddleware);
router.use(sanitizeRequest);

// -------- Planos e billing (1ª fase integração - Crédito Rápido Connect) --------

/**
 * GET /api/subscription_plans
 * Lista planos de assinatura ativos (catálogo global; tabela sem account_id).
 * Qualquer usuário autenticado pode ler. Ordenado por preco_mensal.
 */
router.get('/subscription_plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('preco_mensal', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

/**
 * GET /api/subscription_plans/:id
 * Retorna um plano por id (para useSubscriptionPlan(id) na app).
 */
router.get('/subscription_plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Plano não encontrado' });
      throw error;
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar plano' });
  }
});

/**
 * GET /api/platform_config
 * Query: ?key=billing_mode | billing_checklist | (outras chaves)
 * Retorna { value } da linha com key informada. Config global (tabela key-value).
 */
router.get('/platform_config', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Query key é obrigatória (ex: ?key=billing_mode)' });
    }

    const { data, error } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(200).json({ value: null });
    }
    res.json({ value: data.value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar config' });
  }
});

// -------- Assinaturas SCD (1ª fase - leitura) --------

/**
 * GET /api/scd_subscriptions
 * Lista assinaturas SCD. Isolamento por conta:
 * - scd_user: só assinaturas da própria SCD (scd_id = req.accountId); query scd_id ignorada.
 * - admin: todas, ou filtro opcional ?scd_id= e ?status=
 */
router.get('/scd_subscriptions', async (req, res) => {
  try {
    let query = supabase
      .from('scd_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (req.accountId) {
      query = query.eq('scd_id', req.accountId);
    } else if (req.query.scd_id && typeof req.query.scd_id === 'string') {
      query = query.eq('scd_id', req.query.scd_id);
    }
    if (req.query.status && typeof req.query.status === 'string') {
      query = query.eq('status', req.query.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar assinaturas SCD' });
  }
});

/**
 * GET /api/scd_subscriptions/:id
 * Uma assinatura por id. scd_user só pode ver da própria SCD (scd_id = req.accountId).
 */
router.get('/scd_subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('scd_subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Assinatura não encontrada' });
      throw error;
    }
    if (req.accountId && data.scd_id !== req.accountId) {
      return res.status(403).json({ error: 'Acesso negado a esta assinatura' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
});

/**
 * GET /api/scd_payment_history
 * Histórico de pagamentos SCD. Mesmo isolamento: scd_user só da própria SCD; admin pode listar todos ou ?scd_id=
 */
router.get('/scd_payment_history', async (req, res) => {
  try {
    let query = supabase
      .from('scd_payment_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (req.accountId) {
      query = query.eq('scd_id', req.accountId);
    } else if (req.query.scd_id && typeof req.query.scd_id === 'string') {
      query = query.eq('scd_id', req.query.scd_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar histórico de pagamentos' });
  }
});

// -------- Pedidos de crédito (1ª fase - criação e gestão) --------

/**
 * GET /api/credit_requests
 * Lista pedidos de crédito. Isolamento:
 * - admin: todos; query opcional ?status= ?tier_minimo= ?assigned_scd_id= ?limit=
 * - scd_user: apenas onde assigned_scd_id = req.accountId OU assigned_scd_id is null (disponíveis)
 * - affiliate: apenas onde affiliate_id = req.accountId
 * - consumer: lista vazia (ou não autorizado)
 */
router.get('/credit_requests', async (req, res) => {
  try {
    let query = supabase
      .from('credit_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const countOnly = req.query.count_only === '1' || req.query.count_only === 'true';
    if (!countOnly) query = query.limit(limit);

    if (req.accountId) {
      if (req.role === 'affiliate') {
        query = query.eq('affiliate_id', req.accountId);
      } else if (req.role === 'scd_user') {
        query = query.or(`assigned_scd_id.eq.${req.accountId},assigned_scd_id.is.null`);
      } else {
        return res.status(200).json([]);
      }
    } else {
      if (req.role !== 'admin') return res.status(200).json([]);
      if (req.query.assigned_scd_id && typeof req.query.assigned_scd_id === 'string') {
        query = query.eq('assigned_scd_id', req.query.assigned_scd_id);
      }
    }

    if (req.query.status && typeof req.query.status === 'string') {
      const statuses = req.query.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) query = query.eq('status', statuses[0]);
      else if (statuses.length > 1) query = query.in('status', statuses);
    }
    if (req.query.tier_minimo && typeof req.query.tier_minimo === 'string') {
      query = query.eq('tier_minimo', req.query.tier_minimo);
    }

    if (countOnly) {
      const { count, error: countError } = await query.select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      return res.json({ count: count ?? 0 });
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar pedidos de crédito' });
  }
});

/**
 * GET /api/credit_requests/:id
 * Um pedido por id. scd_user só pode ver se assigned_scd_id = req.accountId ou null. Admin: qualquer.
 */
router.get('/credit_requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('credit_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Pedido não encontrado' });
      throw error;
    }

    if (req.accountId && req.role === 'scd_user') {
      if (data.assigned_scd_id && data.assigned_scd_id !== req.accountId) {
        return res.status(403).json({ error: 'Acesso negado a este pedido' });
      }
    }
    if (req.accountId && req.role === 'affiliate') {
      if (data.affiliate_id !== req.accountId) {
        return res.status(403).json({ error: 'Acesso negado a este pedido' });
      }
    }
    if (req.accountId && req.role !== 'scd_user' && req.role !== 'affiliate' && req.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

/**
 * POST /api/credit_requests
 * Cria pedido de crédito. consumer e affiliate podem criar; affiliate_id injetado se role affiliate.
 */
router.post('/credit_requests', async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.role === 'affiliate' && req.accountId) {
      body.affiliate_id = req.accountId;
    }
    const allowed = [
      'request_code', 'nome', 'documento', 'email', 'telefone', 'cidade', 'tipo', 'valor', 'prazo',
      'finalidade', 'regiao', 'estado', 'tier_minimo', 'urgencia', 'status', 'renda_mensal', 'is_mock', 'affiliate_id'
    ];
    const payload = {};
    for (const k of allowed) {
      if (body[k] !== undefined) payload[k] = body[k];
    }
    if (!payload.request_code || !payload.nome || !payload.documento) {
      return res.status(400).json({ error: 'request_code, nome e documento são obrigatórios' });
    }
    if (!payload.status) payload.status = 'novo';

    const { data, error } = await supabase
      .from('credit_requests')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      ...auditFromRequest(req),
      action: 'create',
      resourceType: 'credit_request',
      resourceId: data?.id,
      newValue: { request_code: payload.request_code }
    });

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar pedido de crédito' });
  }
});

/**
 * PATCH /api/credit_requests/:id
 * Atualiza pedido. admin: qualquer. scd_user: apenas onde assigned_scd_id = req.accountId.
 */
router.patch('/credit_requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from('credit_requests')
      .select('id, assigned_scd_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      if (fetchError?.code === 'PGRST116') return res.status(404).json({ error: 'Pedido não encontrado' });
      throw fetchError;
    }

    if (req.accountId && req.role === 'scd_user') {
      if (existing.assigned_scd_id !== req.accountId) {
        return res.status(403).json({ error: 'Acesso negado a este pedido' });
      }
    }
    if (req.accountId && req.role === 'affiliate') {
      const { data: cr } = await supabase.from('credit_requests').select('affiliate_id').eq('id', id).single();
      if (cr?.affiliate_id !== req.accountId) return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!req.accountId && req.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const allowed = [
      'status', 'assigned_scd_id', 'curated_at', 'curated_by', 'curator_notes', 'contract_closed_at', 'contract_notes', 'contract_value', 'score', 'queue_priority', 'updated_at'
    ];
    const payload = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    }
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo permitido para atualização' });
    }
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('credit_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      ...auditFromRequest(req),
      action: 'update',
      resourceType: 'credit_request',
      resourceId: id,
      newValue: payload
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
});

/**
 * GET /api/credit_request_curation_history
 * Lista histórico de curadoria. Query: ?credit_request_id= obrigatório para filtrar.
 * Acesso ao pedido validado (mesmas regras de GET /credit_requests/:id).
 */
router.get('/credit_request_curation_history', async (req, res) => {
  try {
    const crId = req.query.credit_request_id;
    if (!crId || typeof crId !== 'string') {
      return res.status(400).json({ error: 'Query credit_request_id é obrigatória' });
    }

    const { data: cr, error: crError } = await supabase
      .from('credit_requests')
      .select('id, assigned_scd_id, affiliate_id')
      .eq('id', crId)
      .single();

    if (crError || !cr) {
      if (crError?.code === 'PGRST116') return res.status(404).json({ error: 'Pedido não encontrado' });
      throw crError;
    }

    if (req.accountId && req.role === 'scd_user') {
      if (cr.assigned_scd_id && cr.assigned_scd_id !== req.accountId) {
        return res.status(403).json({ error: 'Acesso negado ao pedido' });
      }
    }
    if (req.accountId && req.role === 'affiliate') {
      if (cr.affiliate_id !== req.accountId) return res.status(403).json({ error: 'Acesso negado ao pedido' });
    }
    if (req.accountId && req.role !== 'scd_user' && req.role !== 'affiliate' && req.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { data, error } = await supabase
      .from('credit_request_curation_history')
      .select('*')
      .eq('credit_request_id', crId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar histórico de curadoria' });
  }
});

/**
 * POST /api/credit_request_curation_history
 * Cria registro de curadoria. Valida acesso ao credit_request (admin ou SCD assignado).
 */
router.post('/credit_request_curation_history', async (req, res) => {
  try {
    const { credit_request_id, action, previous_status, new_status, notes } = req.body;
    if (!credit_request_id || !action || !new_status) {
      return res.status(400).json({ error: 'credit_request_id, action e new_status são obrigatórios' });
    }

    const { data: cr, error: crError } = await supabase
      .from('credit_requests')
      .select('id, assigned_scd_id')
      .eq('id', credit_request_id)
      .single();

    if (crError || !cr) {
      if (crError?.code === 'PGRST116') return res.status(404).json({ error: 'Pedido não encontrado' });
      throw crError;
    }

    if (req.accountId && req.role === 'scd_user') {
      if (cr.assigned_scd_id !== req.accountId) {
        return res.status(403).json({ error: 'Acesso negado ao pedido' });
      }
    }
    if (!req.accountId && req.role !== 'admin') {
      if (req.role !== 'affiliate' && req.role !== 'scd_user') return res.status(403).json({ error: 'Acesso negado' });
    }

    const executedBy = req.role === 'admin' ? 'admin' : (req.accountId || req.userId || 'sistema');

    const { data, error } = await supabase
      .from('credit_request_curation_history')
      .insert({
        credit_request_id,
        action,
        previous_status: previous_status ?? null,
        new_status,
        notes: notes ?? null,
        executed_by: executedBy,
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      ...auditFromRequest(req),
      action: 'create',
      resourceType: 'credit_request_curation_history',
      resourceId: data?.id,
      newValue: { credit_request_id, action, new_status }
    });

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar registro de curadoria' });
  }
});

// -------- Rotas de exemplo / auditoria --------

/**
 * GET /api/example
 * Lista recursos do tenant. account_id vem de req.accountId (token).
 */
router.get('/example', async (req, res) => {
  try {
    let query = supabase.from('example_table').select('*');
    if (req.accountId) {
      query = query.eq('account_id', req.accountId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar' });
  }
});

/**
 * GET /api/audit
 * Logs de auditoria da conta (apenas admin).
 */
router.get('/audit', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (req.accountId) {
      query = query.eq('account_id', req.accountId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar auditoria' });
  }
});

/**
 * POST /api/example (exemplo de criação com auditoria)
 */
router.post('/example', async (req, res) => {
  try {
    if (!req.accountId) {
      return res.status(403).json({ error: 'Operação requer conta (admin não pode criar example)' });
    }
    const payload = { ...req.body, account_id: req.accountId };
    const { data, error } = await supabase
      .from('example_table')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      ...auditFromRequest(req),
      action: 'create',
      resourceType: 'example',
      resourceId: data?.id,
      newValue: payload
    });

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar' });
  }
});

export default router;
