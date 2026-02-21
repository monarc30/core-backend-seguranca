import 'dotenv/config';
import express from 'express';
import { handleStripeWebhook } from './webhooks/stripe.js';
import apiRoutes from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Webhook Stripe: body bruto (para assinatura); outras rotas: JSON
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (req.path === '/webhooks/stripe') return next();
  express.json({ limit: '1mb' })(req, res, next);
});

// Health (sem auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'core-backend-seguranca' });
});

// Webhook Stripe: body já é raw nessa rota; precisamos parsear no handler
app.post('/webhooks/stripe', (req, res, next) => {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      req.body = JSON.parse(body.toString('utf8'));
      req.rawBody = body.toString('utf8');
    } catch (e) {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }
  handleStripeWebhook(req, res).catch(next);
});

// API protegida (auth + sanitização aplicados nas rotas)
app.use('/api', apiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Não encontrado' });
});

// Erro
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Core backend rodando em http://localhost:${PORT}`);
});
