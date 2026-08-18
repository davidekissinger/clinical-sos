// Shared role authorization helper for backend functions.
// Ensures service-role operations are gated by explicit role checks.

export function requireRole(user, allowedRoles) {
  if (!user) return { authorized: false, error: 'Unauthorized', status: 401 };
  const role = user.role || 'user';
  if (!allowedRoles.includes(role)) {
    return { authorized: false, error: `Access denied — role '${role}' is not permitted for this operation.`, status: 403 };
  }
  return { authorized: true };
}

export function requireAdmin(user) {
  return requireRole(user, ['admin']);
}

export function requireAdminOrClinical(user) {
  return requireRole(user, ['admin', 'clinical']);
}

export function requireAdminOrBD(user) {
  return requireRole(user, ['admin', 'business_development']);
}

export function requireAdminBDorClinical(user) {
  return requireRole(user, ['admin', 'business_development', 'clinical']);
}