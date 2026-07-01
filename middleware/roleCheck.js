/**
 * Usage: requireRole('admin') or requireRole('admin', 'traffic_manager')
 * Must run AFTER the `authenticate` middleware (needs req.user).
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = requireRole;
