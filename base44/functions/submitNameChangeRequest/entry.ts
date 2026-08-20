import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { validateDisplayName, validateCredentials, findProfileByUserId, createAuditEvent } from '../../shared/identityUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { requested_display_name, requested_credentials, reason_for_request, supporting_information } = body;

    // Validate required fields
    if (!reason_for_request || !reason_for_request.trim()) {
      return Response.json({ error: 'A reason for the request is required.' }, { status: 400 });
    }

    const nameResult = validateDisplayName(requested_display_name, false);
    if (!nameResult.valid) return Response.json({ error: nameResult.error }, { status: 400 });

    const credResult = validateCredentials(requested_credentials);
    if (!credResult.valid) return Response.json({ error: credResult.error }, { status: 400 });

    // Find or check identity profile
    const profile = await findProfileByUserId(base44, user.id);
    if (!profile) {
      return Response.json({ error: 'No identity profile found. An administrator must initialize your identity first.' }, { status: 404 });
    }

    // Check for existing pending request
    const existingRequests = await base44.asServiceRole.entities.UserNameChangeRequest.filter({
      requesting_user_id: user.id,
      request_status: 'Pending'
    });
    if (existingRequests && existingRequests.length > 0) {
      return Response.json({ error: 'You already have a pending name-change request. Withdraw it before submitting a new one.' }, { status: 409 });
    }

    // Create the request
    const now = new Date().toISOString();
    const newRequest = await base44.asServiceRole.entities.UserNameChangeRequest.create({
      requesting_user_id: user.id,
      identity_profile_id: profile.id,
      current_verified_display_name_snapshot: profile.verified_display_name || null,
      requested_display_name: nameResult.value,
      current_credentials_snapshot: profile.verified_credentials || null,
      requested_credentials: credResult.value || null,
      reason_for_request: reason_for_request.trim(),
      supporting_information: supporting_information ? supporting_information.trim() : null,
      request_status: 'Pending',
      requested_at: now,
    });

    // Update profile: set last_change_request_id, set status to Correction Requested if currently Verified
    const profileUpdates = { last_change_request_id: newRequest.id };
    if (profile.identity_status === 'Verified') {
      profileUpdates.identity_status = 'Correction Requested';
    }
    await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, profileUpdates);

    // Write audit event
    await createAuditEvent(base44, {
      subject_user_id: user.id,
      identity_profile_id: profile.id,
      event_type: 'Name Change Requested',
      old_display_name: profile.verified_display_name || null,
      new_display_name: nameResult.value,
      old_credentials: profile.verified_credentials || null,
      new_credentials: credResult.value || null,
      request_id: newRequest.id,
      reason: reason_for_request.trim(),
      performed_by_user_id: user.id,
      performed_by_name_snapshot: user.full_name || user.email,
      source: 'submitNameChangeRequest',
    });

    return Response.json({ success: true, request_id: newRequest.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}