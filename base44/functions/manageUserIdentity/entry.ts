import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { validateDisplayName, validateCredentials, findProfileByUserId, createAuditEvent, checkDuplicateName } from '../../shared/identityUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: administrator role required.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (!action) return Response.json({ error: 'Action is required.' }, { status: 400 });

    switch (action) {
      case 'init': return await handleInit(base44, user, body);
      case 'verify': return await handleVerify(base44, user, body);
      case 'approve_request': return await handleApproveRequest(base44, user, body);
      case 'deny_request': return await handleDenyRequest(base44, user, body);
      case 'change_credentials': return await handleChangeCredentials(base44, user, body);
      case 'suspend': return await handleSuspend(base44, user, body);
      case 'retire': return await handleRetire(base44, user, body);
      case 'reactivate': return await handleReactivate(base44, user, body);
      default: return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleInit(base44, admin, body) {
  const { target_user_id, verified_display_name, verified_credentials, internal_notes } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-initialization is not permitted. Another administrator must initialize your identity.' }, { status: 403 });

  // Check for existing profile
  const existing = await findProfileByUserId(base44, target_user_id);
  if (existing) return Response.json({ error: 'An identity profile already exists for this user.' }, { status: 409 });

  // Get user data for snapshots
  const targetUser = await base44.asServiceRole.entities.User.get(target_user_id);
  if (!targetUser) return Response.json({ error: 'Target user not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const profile = await base44.asServiceRole.entities.UserIdentityProfile.create({
    user_id: target_user_id,
    email_snapshot: targetUser.email || null,
    provider_full_name_snapshot: targetUser.full_name || null,
    verified_display_name: null,
    verified_credentials: null,
    identity_status: 'Pending Verification',
    active: true,
    internal_notes: internal_notes || null,
  });

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Profile Created',
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:init',
    notes: internal_notes || null,
  });

  return Response.json({ success: true, profile_id: profile.id });
}

async function handleVerify(base44, admin, body) {
  const { target_user_id, verified_display_name, verified_credentials, internal_notes } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-verification is not permitted. Another administrator must verify your identity.' }, { status: 403 });

  const nameResult = validateDisplayName(verified_display_name, true);
  if (!nameResult.valid) return Response.json({ error: nameResult.error }, { status: 400 });

  const credResult = validateCredentials(verified_credentials);
  if (!credResult.valid) return Response.json({ error: credResult.error }, { status: 400 });

  const profile = await findProfileByUserId(base44, target_user_id);
  if (!profile) return Response.json({ error: 'Identity profile not found. Initialize it first.' }, { status: 404 });

  const now = new Date().toISOString();
  const oldName = profile.verified_display_name || null;
  const oldCreds = profile.verified_credentials || null;

  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    verified_display_name: nameResult.value,
    verified_credentials: credResult.value || null,
    identity_status: 'Verified',
    verified_by_user_id: admin.id,
    verified_by_name_snapshot: admin.full_name || admin.email,
    verified_at: now,
    last_changed_at: now,
    internal_notes: internal_notes || profile.internal_notes,
  });

  // Check for duplicate names (non-blocking, for awareness)
  let duplicates = [];
  try {
    duplicates = await checkDuplicateName(base44, nameResult.value, profile.id);
  } catch (e) { /* non-blocking */ }

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Initial Verification',
    old_display_name: oldName,
    new_display_name: nameResult.value,
    old_credentials: oldCreds,
    new_credentials: credResult.value || null,
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:verify',
    notes: duplicates.length > 0 ? `Duplicate name detected: ${duplicates.length} other verified profile(s) share this name.` : null,
  });

  return Response.json({ success: true, duplicate_warning: duplicates.length > 0 ? `${duplicates.length} other verified profile(s) share this name.` : null });
}

async function handleApproveRequest(base44, admin, body) {
  const { request_id, decision_notes } = body;
  if (!request_id) return Response.json({ error: 'Request ID is required.' }, { status: 400 });
  if (!decision_notes || !decision_notes.trim()) return Response.json({ error: 'A documented reason for the approved name change is required.' }, { status: 400 });

  const request = await base44.asServiceRole.entities.UserNameChangeRequest.get(request_id);
  if (!request) return Response.json({ error: 'Request not found.' }, { status: 404 });
  if (request.request_status !== 'Pending') return Response.json({ error: `Request is not pending (status: ${request.request_status}).` }, { status: 400 });
  if (request.requesting_user_id === admin.id) return Response.json({ error: 'Self-approval is not permitted.' }, { status: 403 });

  const profile = await base44.asServiceRole.entities.UserIdentityProfile.get(request.identity_profile_id);
  if (!profile) return Response.json({ error: 'Identity profile not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const oldName = profile.verified_display_name || null;
  const oldCreds = profile.verified_credentials || null;

  // Update profile
  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    verified_display_name: request.requested_display_name,
    verified_credentials: request.requested_credentials || profile.verified_credentials,
    identity_status: 'Verified',
    last_changed_at: now,
    last_change_request_id: request.id,
  });

  // Update request
  await base44.asServiceRole.entities.UserNameChangeRequest.update(request.id, {
    request_status: 'Approved',
    reviewed_by_user_id: admin.id,
    reviewed_by_name_snapshot: admin.full_name || admin.email,
    reviewed_at: now,
    decision_notes: decision_notes.trim(),
    effective_at: now,
  });

  // Check for duplicates
  let duplicates = [];
  try {
    duplicates = await checkDuplicateName(base44, request.requested_display_name, profile.id);
  } catch (e) { /* non-blocking */ }

  await createAuditEvent(base44, {
    subject_user_id: profile.user_id,
    identity_profile_id: profile.id,
    event_type: 'Name Change Approved',
    old_display_name: oldName,
    new_display_name: request.requested_display_name,
    old_credentials: oldCreds,
    new_credentials: request.requested_credentials || oldCreds,
    request_id: request.id,
    reason: decision_notes.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:approve_request',
    notes: duplicates.length > 0 ? `Duplicate name detected: ${duplicates.length} other verified profile(s) share this name.` : null,
  });

  return Response.json({ success: true, duplicate_warning: duplicates.length > 0 ? `${duplicates.length} other verified profile(s) share this name.` : null });
}

async function handleDenyRequest(base44, admin, body) {
  const { request_id, decision_notes } = body;
  if (!request_id) return Response.json({ error: 'Request ID is required.' }, { status: 400 });
  if (!decision_notes || !decision_notes.trim()) return Response.json({ error: 'A documented reason for denying the request is required.' }, { status: 400 });

  const request = await base44.asServiceRole.entities.UserNameChangeRequest.get(request_id);
  if (!request) return Response.json({ error: 'Request not found.' }, { status: 404 });
  if (request.request_status !== 'Pending') return Response.json({ error: `Request is not pending (status: ${request.request_status}).` }, { status: 400 });
  if (request.requesting_user_id === admin.id) return Response.json({ error: 'Self-denial is not permitted.' }, { status: 403 });

  const now = new Date().toISOString();

  // Update request
  await base44.asServiceRole.entities.UserNameChangeRequest.update(request.id, {
    request_status: 'Denied',
    reviewed_by_user_id: admin.id,
    reviewed_by_name_snapshot: admin.full_name || admin.email,
    reviewed_at: now,
    decision_notes: decision_notes.trim(),
  });

  // If profile status was 'Correction Requested', revert to 'Verified'
  if (request.identity_profile_id) {
    const profile = await base44.asServiceRole.entities.UserIdentityProfile.get(request.identity_profile_id);
    if (profile && profile.identity_status === 'Correction Requested') {
      await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, { identity_status: 'Verified' });
    }
  }

  await createAuditEvent(base44, {
    subject_user_id: request.requesting_user_id,
    identity_profile_id: request.identity_profile_id || null,
    event_type: 'Name Change Denied',
    old_display_name: request.current_verified_display_name_snapshot || null,
    new_display_name: null,
    request_id: request.id,
    reason: decision_notes.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:deny_request',
  });

  return Response.json({ success: true });
}

async function handleChangeCredentials(base44, admin, body) {
  const { target_user_id, verified_credentials, reason } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-credential-change is not permitted.' }, { status: 403 });
  if (!reason || !reason.trim()) return Response.json({ error: 'A reason for the credential change is required.' }, { status: 400 });

  const credResult = validateCredentials(verified_credentials);
  if (!credResult.valid) return Response.json({ error: credResult.error }, { status: 400 });

  const profile = await findProfileByUserId(base44, target_user_id);
  if (!profile) return Response.json({ error: 'Identity profile not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const oldCreds = profile.verified_credentials || null;

  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    verified_credentials: credResult.value || null,
    last_changed_at: now,
  });

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Credentials Changed',
    old_credentials: oldCreds,
    new_credentials: credResult.value || null,
    reason: reason.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:change_credentials',
  });

  return Response.json({ success: true });
}

async function handleSuspend(base44, admin, body) {
  const { target_user_id, reason } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-suspension is not permitted.' }, { status: 403 });
  if (!reason || !reason.trim()) return Response.json({ error: 'A reason for suspension is required.' }, { status: 400 });

  const profile = await findProfileByUserId(base44, target_user_id);
  if (!profile) return Response.json({ error: 'Identity profile not found.' }, { status: 404 });

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    identity_status: 'Suspended',
    active: false,
    last_changed_at: now,
  });

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Identity Suspended',
    old_display_name: profile.verified_display_name || null,
    new_display_name: profile.verified_display_name || null,
    reason: reason.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:suspend',
  });

  return Response.json({ success: true });
}

async function handleRetire(base44, admin, body) {
  const { target_user_id, reason } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-retirement is not permitted.' }, { status: 403 });
  if (!reason || !reason.trim()) return Response.json({ error: 'A reason for retirement is required.' }, { status: 400 });

  const profile = await findProfileByUserId(base44, target_user_id);
  if (!profile) return Response.json({ error: 'Identity profile not found.' }, { status: 404 });

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    identity_status: 'Retired',
    active: false,
    last_changed_at: now,
  });

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Identity Retired',
    old_display_name: profile.verified_display_name || null,
    new_display_name: profile.verified_display_name || null,
    reason: reason.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:retire',
  });

  return Response.json({ success: true });
}

async function handleReactivate(base44, admin, body) {
  const { target_user_id, reason } = body;
  if (!target_user_id) return Response.json({ error: 'Target user ID is required.' }, { status: 400 });
  if (target_user_id === admin.id) return Response.json({ error: 'Self-reactivation is not permitted.' }, { status: 403 });
  if (!reason || !reason.trim()) return Response.json({ error: 'A reason for reactivation is required.' }, { status: 400 });

  const profile = await findProfileByUserId(base44, target_user_id);
  if (!profile) return Response.json({ error: 'Identity profile not found.' }, { status: 404 });

  const now = new Date().toISOString();
  // Reactivation restores to Verified if the user had been verified, otherwise Pending Verification
  const newStatus = profile.verified_display_name ? 'Verified' : 'Pending Verification';
  await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
    identity_status: newStatus,
    active: true,
    last_changed_at: now,
  });

  await createAuditEvent(base44, {
    subject_user_id: target_user_id,
    identity_profile_id: profile.id,
    event_type: 'Identity Reactivated',
    old_display_name: profile.verified_display_name || null,
    new_display_name: profile.verified_display_name || null,
    reason: reason.trim(),
    performed_by_user_id: admin.id,
    performed_by_name_snapshot: admin.full_name || admin.email,
    source: 'manageUserIdentity:reactivate',
  });

  return Response.json({ success: true });
}