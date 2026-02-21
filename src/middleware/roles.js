/**
 * Middleware de autorização por role.
 * Uso: router.get('/admin/settings', requireRole('admin', 'super_admin'), handler)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}
