import crypto from 'crypto';
import { supabase } from '../lib/supabase.js';
import { auditLog } from '../lib/audit.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Verifica assinatura do webhook Stripe (Stripe-Signature).
 */
function verifyStripeSignature(rawBody, signature) {
  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET não definido');
    return false;
  }
  const elements = signature.split(',');
  const sig = elements.find(e => e.startsWith('v1='));
  if (!sig) return false;
  const expected = sig.replace('v1=', '');
  const signed = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signed, 'hex'));
}

/**
 * Idempotência: insere event_id. Se já existir (23505), retorna null (já processado).
 */
async function ensureIdempotency(eventId, provider = 'stripe') {
  const { data, error } = await supabase
    .from('webhook_events_processed')
    .insert({ event_id: eventId, provider, outcome: 'processing' })
    .select('event_id')
    .single();

  if (error) {
    if (error.code === '23505') return null; // já processado
    throw error;
  }
  return data;
}

/**
 * Atualiza outcome do evento processado.
 */
async function setWebhookOutcome(eventId, outcome) {
  await supabase
    .from('webhook_events_processed')
    .update({ outcome })
    .eq('event_id', eventId);
}

/**
 * Handler do webhook Stripe.
 * - Valida assinatura
 * - Idempotência por event.id
 * - Processa apenas eventos desejados (ex.: invoice.paid, customer.subscription.updated)
 */
export async function handleStripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Assinatura ausente' });
  }

  // rawBody deve ser o body bruto (buffer/string) para verificar assinatura
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body);
  if (!verifyStripeSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  const event = req.body;
  const eventId = event?.id;
  if (!eventId) {
    return res.status(400).json({ error: 'Evento sem id' });
  }

  let inserted;
  try {
    inserted = await ensureIdempotency(eventId);
  } catch (err) {
    console.error('Idempotência webhook:', err);
    return res.status(500).json({ error: 'Erro ao processar' });
  }

  if (!inserted) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'invoice.paid':
        // Exemplo: atualizar assinatura/plano no seu banco
        // await updateSubscriptionFromInvoice(event.data.object);
        await auditLog({
          accountId: event.data?.object?.metadata?.account_id || null,
          action: 'billing_event',
          resourceType: 'invoice',
          resourceId: event.data?.object?.id,
          newValue: { type: 'invoice.paid', amount: event.data?.object?.amount_paid }
        });
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Exemplo: sincronizar plano
        await auditLog({
          accountId: event.data?.object?.metadata?.account_id || null,
          action: 'plan_change',
          resourceType: 'subscription',
          resourceId: event.data?.object?.id,
          newValue: { status: event.data?.object?.status }
        });
        break;
      default:
        // Outros eventos: só registrar que recebeu
        break;
    }
    await setWebhookOutcome(eventId, 'success');
  } catch (err) {
    console.error('Processamento webhook:', err);
    await setWebhookOutcome(eventId, 'error');
    return res.status(500).json({ error: 'Erro ao processar evento' });
  }

  return res.status(200).json({ received: true });
}
