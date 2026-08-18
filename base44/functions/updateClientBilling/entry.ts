import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { auditAccessChange } from "../../shared/clientEntitlements.ts";

const VALID_BILLING_STATUSES = ['Current', 'Invoice Due', 'Past Due', 'Payment Arrangement', 'Paid', 'Disputed', 'Unknown'];
const VALID_SUBSCRIPTION_STATUSES = ['Active', 'Trial', 'Grace Period', 'Past Due', 'Cancelled', 'Expired', 'Not Applicable'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'finance') {
      return Response.json({ error: 'Forbidden — admin or finance only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      client_account_id,
      billing_status,
      subscription_status,
      subscription_plan,
      subscription_start_date,
      subscription_renewal_date,
      subscription_end_date,
      past_due_since,
      grace_period_end,
      reason
    } = body;

    if (!client_account_id) return Response.json({ error: 'client_account_id is required' }, { status: 400 });

    // Finance can only update billing/subscription fields — NOT access_status
    const update = {};
    if (billing_status !== undefined) {
      if (!VALID_BILLING_STATUSES.includes(billing_status)) return Response.json({ error: 'Invalid billing_status' }, { status: 400 });
      update.billing_status = billing_status;
    }
    if (subscription_status !== undefined) {
      if (!VALID_SUBSCRIPTION_STATUSES.includes(subscription_status)) return Response.json({ error: 'Invalid subscription_status' }, { status: 400 });
      update.subscription_status = subscription_status;
    }
    if (subscription_plan !== undefined) update.subscription_plan = subscription_plan;
    if (subscription_start_date !== undefined) update.subscription_start_date = subscription_start_date;
    if (subscription_renewal_date !== undefined) update.subscription_renewal_date = subscription_renewal_date;
    if (subscription_end_date !== undefined) update.subscription_end_date = subscription_end_date;
    if (past_due_since !== undefined) update.past_due_since = past_due_since;
    if (grace_period_end !== undefined) update.grace_period_end = grace_period_end;

    const account = await base44.asServiceRole.entities.ClientAccount.get(client_account_id);
    if (!account) return Response.json({ error: 'Client account not found' }, { status: 404 });

    const previousBillingState = account.billing_status;
    const previousSubscriptionState = account.subscription_status;

    await base44.asServiceRole.entities.ClientAccount.update(client_account_id, update);

    // Write audit log
    await auditAccessChange(base44, {
      client_account_id,
      previous_access_state: `billing:${previousBillingState}, subscription:${previousSubscriptionState}`,
      new_access_state: `billing:${billing_status || previousBillingState}, subscription:${subscription_status || previousSubscriptionState}`,
      reason: reason || 'Billing/subscription update',
      triggering_source: 'finance_billing_update',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    // Propose access_status change if business rules indicate (admin must finalize)
    let proposedAccessChange = null;
    if (billing_status === 'Past Due' && grace_period_end) {
      const graceEnd = new Date(grace_period_end);
      if (graceEnd < new Date()) proposedAccessChange = 'Restricted';
    }
    if (subscription_status === 'Expired') proposedAccessChange = proposedAccessChange || 'Restricted';
    if (subscription_status === 'Cancelled') proposedAccessChange = 'Suspended';

    return Response.json({
      success: true,
      client_account_id,
      updated_fields: Object.keys(update),
      proposed_access_change: proposedAccessChange ? {
        recommended_status: proposedAccessChange,
        note: 'Admin must finalize access_status change via transitionClientAccess'
      } : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}