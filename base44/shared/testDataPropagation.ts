// Shared test-data propagation helper.
// If any parent record in the workflow chain has is_test_data = true,
// downstream records must inherit is_test_data = true.

export function resolveTestData(parents) {
  // parents: array of records that may have is_test_data field
  for (const p of parents) {
    if (p && p.is_test_data === true) return true;
  }
  return false;
}

// Determine test-data status by walking the parent chain.
// svc: base44.asServiceRole client
// chain: array of { entity, id } pairs to check (in order of ancestry)
export async function resolveTestDataFromChain(svc, chain) {
  for (const { entity, id } of chain) {
    if (!id) continue;
    try {
      const record = await svc.entities[entity].get(id);
      if (record && record.is_test_data === true) return true;
    } catch (e) { /* best-effort */ }
  }
  return false;
}