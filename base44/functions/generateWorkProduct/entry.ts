import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { document_type, deficiency_id, facility_name, f_tag, regulatory_case_id, engagement_id, prompt } = body;

    if (!document_type || !prompt) return Response.json({ error: 'document_type and prompt are required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Generate work product content via LLM
    const llmResult = await svc.integrations.Core.InvokeLLM({
      prompt: `You are a long-term care regulatory consultant. Generate a professional work product based on the following request. Use ONLY the information provided. Do NOT invent F-tags, findings, residents, dates, scope/severity, enforcement actions, regulations, or survey language. If information is missing, state "To be completed." Mark any AI-generated content as DRAFT.\n\nDocument Type: ${document_type}\nFacility: ${facility_name || '—'}\nF-Tag: ${f_tag || '—'}\n\n${prompt}`,
    });

    const content = typeof llmResult === 'string' ? llmResult : (llmResult?.content || JSON.stringify(llmResult));

    // Create WorkProduct record
    const wp = await svc.entities.WorkProduct.create({
      document_type,
      facility_name,
      deficiency_id: deficiency_id || null,
      regulatory_case_id: regulatory_case_id || null,
      engagement_id: engagement_id || null,
      f_tag: f_tag || null,
      generation_date: new Date().toISOString(),
      document_status: 'DRAFT',
      preparer: user.full_name || user.email || 'System',
      version: '1.0',
      content,
      is_test_data: false,
    });

    return Response.json({
      ok: true,
      work_product_id: wp.id,
      document_type,
      document_status: 'DRAFT',
      content,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}