import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { createAuditEvent } from '../../shared/identityUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { request_id } = body;
    if (!request_id) return Response.json({ error: 'Request ID is required.' }, { status: 400 });

    // Find the request
    const request = await base44.asServiceRole.entities.UserNameChangeRequest.get(request_id);
    if (!request) return Response.json({ error: 'Request not found.' }, { status: 404 });

    // Verify ownership: requesting_user_id must match the authenticated user
    if (request.requesting_user_id !== user.id) {
      return Response.json({ error: 'You can only withdraw your own requests.' }, { status: 403 });
    }

    // Only pending requests can be withdrawn
    if (request.request_status !== 'Pending') {
      return Response.json({ error: `Cannot withdraw a request with status '${request.request_status}'.` }, { status: 400 });
    }

    // Update request status
    await base44.asServiceRole.entities.UserNameChangeRequest.update(request.id, {
      request_status: 'Withdrawn',
      reviewed_at: new Date().toISOString(),
    });

    // If profile status was 'Correction Requested', revert to 'Verified'
    if (request.identity_profile_id) {
      const profile = await base44.asServiceRole.entities.UserIdentityProfile.get(request.identity_profile_id);
      if (profile && profile.identity_status === 'Correction Requested') {
        await base44.asServiceRole.entities.UserIdentityProfile.update(profile.id, {
          identity_status: 'Verified'
        });
      }
    }

    // Write audit event
    await createAuditEvent(base44, {
      subject_user_id: user.id,
      identity_profile_id: request.identity_profile_id || null,
      event_type: 'Name Change Denied',
      old_display_name: request.current_verified_display_name_snapshot || null,
      new_display_name: null,
      request_id: request.id,
      reason: 'Withdrawn by requesting user',
      performed_by_user_id: user.id,
      performed_by_name_snapshot: user.full_name || user.email,
      source: 'withdrawNameChangeRequest',
      notes: 'User withdrew their own pending request',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}