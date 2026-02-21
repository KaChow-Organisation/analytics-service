// ============================================================================
// INTENTIONAL ARCHITECTURAL VIOLATION
// Added for dependency graph analysis
// 
// This file creates a circular dependency:
// shared-contracts -> auth-service (imports this helper)
// auth-service -> shared-contracts (imports schemas)
// 
// CYCLE: shared-contracts <-> auth-service
// ============================================================================

/**
 * Token validation helper
 * Used by shared-contracts for cross-service token operations
 */
function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token must be a string' };
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' };
  }
  
  return { valid: true, format: 'JWT-like' };
}

/**
 * Helper to check if a token is expired
 * Used by shared-contracts for validation logic
 */
function isTokenExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

module.exports = {
  validateTokenFormat,
  isTokenExpired
};
