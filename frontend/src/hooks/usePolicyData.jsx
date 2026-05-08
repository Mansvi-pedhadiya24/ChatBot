import { useState, useCallback } from "react";
import { API } from "../firebase/config";

export function usePolicyData(sessionId) {
  const [policy, setPolicy] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicy = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/policy/${sessionId}`);
      const data = await res.json();
      setPolicy(res.ok ? data : null);
    } catch { 
      setPolicy(null); 
    } finally { 
      setLoading(false); 
    }
  }, [sessionId]);

  const fetchVersions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}/policy/${sessionId}/versions/all`);
      const data = await res.json();
      setVersions(res.ok ? (data.versions || []) : []);
    } catch { 
      setVersions([]); 
    }
  }, [sessionId]);

  const resetPolicy = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`${API}/policy/${sessionId}/reset`, { method: "POST" });
    setPolicy(null);
    fetchVersions();
  }, [sessionId, fetchVersions]);

  return { policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy };
}