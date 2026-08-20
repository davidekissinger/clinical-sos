// Centralized identity validation and audit utilities.
// Shared by all identity-management backend functions to avoid duplication.

const RESERVED_NAME_FRAGMENTS = ["administrator", "system", "clinical reviewer"];

/**
 * Validate a display name.
 * @param {string} raw - the raw name input
 * @param {boolean} allowReserved - if true, reserved system labels are allowed (admin override)
 * @returns {{ valid: boolean, error?: string, value?: string, reservedFlag?: boolean }}
 */
export function validateDisplayName(raw, allowReserved) {
  if (!raw || typeof raw !== "string") return { valid: false, error: "Name is required." };
  const trimmed = raw.trim();
  if (trimmed.length < 2) return { valid: false, error: "Name must be at least 2 characters." };
  if (trimmed.length > 100) return { valid: false, error: "Name must not exceed 100 characters." };
  if (/[\x00-\x1f\x7f<>{}\\]/.test(trimmed)) return { valid: false, error: "Name contains invalid characters." };
  const lower = trimmed.toLowerCase();
  for (const fragment of RESERVED_NAME_FRAGMENTS) {
    if (lower === fragment) {
      if (allowReserved) return { valid: true, value: trimmed, reservedFlag: true };
      return { valid: false, error: `"${trimmed}" is a reserved system label. An administrator must explicitly approve it.` };
    }
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate professional credentials. Credentials are optional.
 * @param {string} raw
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
export function validateCredentials(raw) {
  if (!raw) return { valid: true, value: "" };
  if (typeof raw !== "string") return { valid: false, error: "Credentials must be text." };
  const trimmed = raw.trim();
  if (trimmed.length < 2) return { valid: false, error: "Credentials must be at least 2 characters." };
  if (trimmed.length > 50) return { valid: false, error: "Credentials must not exceed 50 characters." };
  if (/[\x00-\x1f\x7f<>{}\\]/.test(trimmed)) return { valid: false, error: "Credentials contain invalid characters." };
  return { valid: true, value: trimmed };
}

/**
 * Write an immutable audit event to UserIdentityAuditEvent.
 * Always uses service role to bypass RLS.
 * @param {object} base44 - SDK client
 * @param {object} eventData
 */
export async function createAuditEvent(base44, eventData) {
  return await base44.asServiceRole.entities.UserIdentityAuditEvent.create({
    ...eventData,
    event_timestamp: new Date().toISOString(),
  });
}

/**
 * Find an identity profile by user_id. Returns null if not found.
 * @param {object} base44 - SDK client (uses asServiceRole)
 * @param {string} userId
 */
export async function findProfileByUserId(base44, userId) {
  const profiles = await base44.asServiceRole.entities.UserIdentityProfile.filter({ user_id: userId });
  return (profiles && profiles.length > 0) ? profiles[0] : null;
}

/**
 * Check for exact duplicate display names (for admin awareness, not rejection).
 * @param {object} base44
 * @param {string} displayName
 * @param {string} excludeProfileId
 */
export async function checkDuplicateName(base44, displayName, excludeProfileId) {
  const matches = await base44.asServiceRole.entities.UserIdentityProfile.filter({
    verified_display_name: displayName,
    identity_status: "Verified"
  });
  return (matches || []).filter(p => p.id !== excludeProfileId);
}

/**
 * Return only the limited, non-sensitive portion of a profile for user-facing display.
 */
export function safeProfileForUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.user_id,
    verified_display_name: profile.verified_display_name,
    verified_credentials: profile.verified_credentials,
    identity_status: profile.identity_status,
    email_snapshot: profile.email_snapshot,
    provider_full_name_snapshot: profile.provider_full_name_snapshot,
  };
}

/**
 * Return only the limited, non-sensitive portion of a request for user-facing display.
 * Strips decision_notes and reviewer information.
 */
export function safeRequestForUser(request) {
  if (!request) return null;
  return {
    id: request.id,
    requested_display_name: request.requested_display_name,
    requested_credentials: request.requested_credentials,
    reason_for_request: request.reason_for_request,
    request_status: request.request_status,
    requested_at: request.requested_at,
    reviewed_at: request.reviewed_at,
    effective_at: request.effective_at,
  };
}