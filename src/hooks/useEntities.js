import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Lightweight data hook for command center pages.
export function useEntities(entityName, { sort, limit, filter } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (filter) res = await base44.entities[entityName].filter(filter, sort, limit);
      else res = await base44.entities[entityName].list(sort, limit);
      setData(Array.isArray(res) ? res : (res?.data || []));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [entityName, sort, limit, JSON.stringify(filter)]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, setData };
}