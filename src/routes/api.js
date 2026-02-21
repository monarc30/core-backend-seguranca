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

/**
 * GET /api/example
 * Lista recursos do tenant. account_id vem de req.accountId (token).
 */
router.get('/example', async (req, res) => {
  try {
    // Sempre filtrar por req.accountId — nunca por body/query
    const { data, error } = await supabase
      .from('example_table')
      .select('*')
      .eq('account_id', req.accountId);

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
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('account_id', req.accountId)
      .order('created_at', { ascending: false })
      .limit(100);

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
