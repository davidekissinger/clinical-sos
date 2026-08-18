import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useTestData } from "@/lib/TestDataContext";

// Lightweight data hook for command center pages.
// When excludeTestData is true and the Show Test Data toggle is OFF,
// records with is_test_data === true are excluded from results.
export function useEntities(entityName, { sort, limit, filter, excludeTestData } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showTestData } = useTestData();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = { ...(filter || {}) };
      if (excludeTestData && !showTestData) {
        query.is_test_data = { $ne: true };
      }
      let res;
      if (Object.keys(query).length > 0) res = await base44.entities[entityName].filter(query, sort, limit);
      else res = await base44.entities[entityName].list(sort, limit);
      setData(Array.isArray(res) ? res : (res?.data || []));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [entityName, sort, limit, JSON.stringify(filter), excludeTestData, showTestData]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, setData };
}