import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { findProfileByUserId, safeProfileForUser, safeRequestForUser } from '../../shared/identityUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await findProfileByUserId(base44, user.id);

    let requests = [];
    if (profile) {
      requests = await base44.asServiceRole.entities.UserNameChangeRequest.filter({
        requesting_user_id: user.id
      });
    }

    return Response.json({
      profile: profile ? safeProfileForUser(profile) : null,
      requests: (requests || []).map(safeRequestForUser),
      provider_full_name: user.full_name || null,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}