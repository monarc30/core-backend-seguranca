/**
 * Remove account_id de body, query e params.
 * Garante que nenhuma rota use account_id vindo do frontend.
 * O account_id válido está em req.accountId (injetado pelo authMiddleware).
 */
export function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    delete req.body.account_id;
  }
  if (req.query && typeof req.query === 'object') {
    delete req.query.account_id;
  }
  if (req.params && typeof req.params === 'object') {
    delete req.params.account_id;
  }
  next();
}
