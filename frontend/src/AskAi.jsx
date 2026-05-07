import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, off } from "firebase/database";

const firebaseConfig = {
  apiKey: "WEB_API_KEY",
  authDomain: "tellustheodds-chat.firebaseapp.com",
  databaseURL: "https://tellustheodd-default-rtdb.firebaseio.com",
  projectId: "TellUSTheOdd",
  storageBucket: "TellUSTheOdd.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

const API = "http://localhost:8000";

const FIELDS = [
  { key: "name", label: "Full Name", icon: "👤", type: "text", placeholder: "e.g. John Roy" },
  { key: "age", label: "Age", icon: "🎂", type: "number", placeholder: "e.g. 55" },
  { key: "policy_type", label: "Policy Type", icon: "📋", type: "select", options: ["Traditional", "Hybrid", "Annuity", "Chronic illness rider"] },
  { key: "premium", label: "Monthly Premium ($)", icon: "💰", type: "number", placeholder: "e.g. 250" },
  { key: "benefit_amount", label: "Benefit Amount ($)", icon: "🏥", type: "number", placeholder: "e.g. 5000" },
  { key: "elimination_period", label: "Elimination Period", icon: "⏳", type: "select", options: ["30 days", "60 days", "90 days", "180 days"] },
  { key: "inflation_protection", label: "Inflation Protection", icon: "📈", type: "select", options: ["None", "3% compound", "5% compound", "CPI-linked"] },
];
// ── WebSocket hook ──
function useWebSocket(url, sessionId) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const isConnecting = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (isConnecting.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    isConnecting.current = true;
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      isConnecting.current = false;
      setStatus("connected");
    };
    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === "history") {
        const hist = (data.messages || []).map((m, i) => ({
          id: `hist_${i}_${Date.now()}`,
          type: m.sender === "user" ? "user" : "bot",
          text: m.content || m.text || "",
          timestamp: m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "",
        }));
        setMessages(hist);
        return;
      }
      if (data.type === "bot") {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          type: "bot",
          text: data.text || "",
          timestamp: data.timestamp || "",
        }]);
        if (typeof onBotMessage === "function") onBotMessage();
      }
    };
    ws.onerror = () => { isConnecting.current = false; if (mountedRef.current) setStatus("error"); };
    ws.onclose = () => {
      isConnecting.current = false;
      if (!mountedRef.current) return;
      setStatus("disconnected");
      clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        text,
        session_id: sessionId,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
    }
  }, [sessionId]);

  return { status, messages, send };
}
// ── Typing hook ──
function useTyping(sessionId) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const statRef = ref(db, `status/${sessionId}`);
    const unsub = onValue(statRef, (snap) => {
      const s = snap.val();
      if (s?.typing !== undefined) setTyping(s.typing);
    });
    return () => off(statRef, "value", unsub);
  }, [sessionId]);
  return typing;
}
// ── Policy data hook ──
function usePolicyData(sessionId) {
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
    } catch { setPolicy(null); }
    finally { setLoading(false); }
  }, [sessionId]);

  const fetchVersions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}/policy/${sessionId}/versions/all`);
      const data = await res.json();
      setVersions(res.ok ? (data.versions || []) : []);
    } catch { setVersions([]); }
  }, [sessionId]);

  const resetPolicy = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`${API}/policy/${sessionId}/reset`, { method: "POST" });
    setPolicy(null);
    fetchVersions();
  }, [sessionId, fetchVersions]);

  return { policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy };
}
// ── Small UI components ──
const StatusDot = ({ status }) => {
  const colors = { connected: "#2ecc71", connecting: "#f1c40f", disconnected: "#e74c3c", error: "#e74c3c" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[status] }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 500, textTransform: "uppercase" }}>
        {status}
      </span>
    </div>
  );
};

const Message = ({ msg, isUser }) => {
  const formatText = (text) =>
    String(text).split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p
    );
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16, animation: "msgIn 0.3s ease-out" }}>
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          background: isUser ? "#1a4a7a" : "#ffffff",
          color: isUser ? "#ffffff" : "#334155",
          fontSize: "14px", lineHeight: "1.6",
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          border: isUser ? "none" : "1px solid #e2e8f0",
          whiteSpace: "pre-wrap",
        }}>
          {isUser ? msg.text : formatText(msg.text)}
        </div>
        <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: 4, textAlign: isUser ? "right" : "left" }}>
          {msg.timestamp}
        </div>
      </div>
    </div>
  );
};

// ──  Widget snippet Button ──
const FloatingChatButton = ({ onClick, isOpen }) => {
  const [showLabel, setShowLabel] = useState(true);

  return (
    <>
      <style>{`
        @keyframes fabPop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .fab-btn { transition: transform 0.2s, background 0.2s; }
        .fab-btn:hover { transform: scale(1.08) !important; background: #1a4a7a !important; }
      `}</style>

      {/* Label tooltip */}
      {showLabel && !isOpen && (
        <div style={{
          position: "fixed", bottom: 34, right: 88,
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 20, padding: "5px 12px",
          fontSize: 14, color: "#334155", whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          animation: "fabPop 0.3s ease-out",
          zIndex: 9998,
        }}>
          Free to Ask
          <button onClick={() => setShowLabel(false)}
            style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8", padding: 0 }}>
            ✕
          </button>
        </div>
      )}

      {/* FAB Button */}
      <button
        className="fab-btn"
        onClick={onClick}
        aria-label={isOpen ? "close the chat" : "Free to ask"}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 56, height: 56,
          borderRadius: "50%",
          background: "#0f3460",
          border: "none",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 9999,
          fontSize: 24, color: "#fff",
        }}
      >
        {isOpen ? "✕" : "💬"}
        {/* Notification badge */}
        {!isOpen && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 14, height: 14, borderRadius: "50%",
            background: "#d4af37", border: "2px solid #fff",
            fontSize: 8, fontWeight: 700, color: "#7a5a00",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>1</span>
        )}
      </button>
    </>
  );
};

const TypingIndicator = () => (
  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
    <div style={{ padding: "12px 16px", borderRadius: "12px 12px 12px 2px", background: "#ffffff", border: "1px solid #e2e8f0", display: "flex", gap: 4, alignItems: "center" }}>
      {[0, 0.18, 0.36].map((d, i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", animation: "dotB 1.1s infinite", animationDelay: `${d}s`, display: "inline-block" }} />
      ))}
    </div>
  </div>
);
// ── History Drawer ──
const HistoryDrawer = ({ versions, onClose }) => {
  const [expanded, setExpanded] = useState(null);
  const archived = versions.filter(v => !v.is_active);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460" }}>📂 Policy History</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{archived.length} previous {archived.length === 1 ? "policy" : "policies"} — read only</div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
      </div>

      <div className="scroll-hide" style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {archived.length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
            <p style={{ fontSize: 13 }}>No previous policies yet.</p>
          </div>
        )}
        {archived.map((v) => {
          const name = v.policy_data?.name || "Unnamed";
          const pType = v.policy_data?.policy_type || "—";
          const date = v.created_at ? new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
          const hPct = Math.round((v.filled_count / 7) * 100);
          const isOpen = expanded === v.version;

          return (
            <div key={v.version} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div
                onClick={() => setExpanded(isOpen ? null : v.version)}
                style={{ padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8faff"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 30, height: 30, borderRadius: 6, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#4338ca", flexShrink: 0 }}>
                  v{v.version}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{pType} · {date}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: hPct === 100 ? "#1a7a4a" : "#64748b" }}>{v.filled_count}/7</div>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</div>
                </div>
              </div>

              <div style={{ height: 2, background: "#e2e8f0", margin: "0 14px" }}>
                <div style={{ height: "100%", width: `${hPct}%`, background: hPct === 100 ? "#1a7a4a" : "linear-gradient(90deg,#6366f1,#818cf8)", borderRadius: 2, transition: "width .3s" }} />
              </div>

              {isOpen && (
                <div style={{ padding: "10px 14px 12px", borderTop: "1px solid #f1f5f9", animation: "slideDown 0.15s ease-out" }}>
                  {FIELDS.map((f) => {
                    const val = v.policy_data?.[f.key];
                    return (
                      <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
                        <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", width: 110, flexShrink: 0 }}>{f.label}</span>
                        <span style={{ fontSize: 12, fontWeight: val ? 500 : 400, color: val ? "#0f3460" : "#cbd5e0", fontStyle: val ? "normal" : "italic" }}>
                          {val || "—"}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
                    🔒 Read only — archived policy
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
// ── Decision Panel ──
const DECISION_COLORS = {
  keep: { border: "#1a7a4a", badge: "#e8f8f0", badgeText: "#1a7a4a", label: "Stay Protected" },
  lapse: { border: "#92400e", badge: "#fffbeb", badgeText: "#92400e", label: "Stop & Walk Away" },
  sell: { border: "#1a4a7a", badge: "#e6f1fb", badgeText: "#1a4a7a", label: "Cash Out" },
};
const DecisionPanel = ({ sessionId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/policy/${sessionId}/decision`)
      .then(r => r.json())
      .then(d => {
        console.log("[DecisionPanel] full data:", JSON.stringify(d, null, 2));
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError("Could not load analysis.");
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Analyzing your policy...</div>;
  if (error) return <div style={{ padding: 32, textAlign: "center", color: "#e74c3c" }}>{error}</div>;
  if (!data || !data.options) return <div style={{ padding: 32, textAlign: "center", color: "#e74c3c" }}>No analysis data returned.</div>;

  const recommended = (data?.recommended || "keep").toLowerCase();
  const recColor = DECISION_COLORS[recommended] || DECISION_COLORS["keep"];
  const finalAnswer = data?.final_answer || `Recommendation: ${recColor.label}`;
  const recommendedOption = data.options[recommended];  // direct access, no optional chain

  console.log("[DecisionPanel] recommended:", recommended, "option:", recommendedOption);

  return (
    <div style={{ padding: "16px", background: "#f8fafc", overflowY: "auto", height: "100%" }} className="scroll-hide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460" }}>Policy Decision Analysis</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>Educational only — not financial advice</div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 14, color: "#64748b" }}>✕</button>
      </div>

      <div style={{
        marginBottom: 14, padding: "10px 14px", borderRadius: 10,
        background: "#eff6ff", border: `1px solid ${recColor.border}`,
        fontSize: 13, color: recColor.border, fontWeight: 600, lineHeight: 1.5,
      }}>
        {finalAnswer}
      </div>

      {/* Show ALL 3 options, recommended highlighted */}
      {["keep", "lapse", "sell"].map((key) => {
        const opt = data.options[key];
        const color = DECISION_COLORS[key];
        const isRec = key === recommended;
        if (!opt) return null;
        return (
          <div key={key} style={{
            marginBottom: 10, background: "#fff",
            border: isRec ? `2px solid ${color.border}` : "1px solid #e2e8f0",
            borderRadius: 10, overflow: "hidden",
            opacity: isRec ? 1 : 0.7,
          }}>
            <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", display: "flex", alignItems: "center", gap: 6 }}>
                  {opt.label}
                  {isRec && <span style={{ fontSize: 9, background: color.badge, color: color.badgeText, padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>RECOMMENDED</span>}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{opt.summary}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 52 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: color.badgeText }}>{opt.score}</div>
                <div style={{ width: 48, height: 4, background: "#e2e8f0", borderRadius: 4, marginTop: 3 }}>
                  <div style={{ width: `${opt.score}%`, height: "100%", background: color.border, borderRadius: 4 }} />
                </div>
              </div>
            </div>
            {isRec && (
              <div style={{ padding: "0 14px 8px", borderTop: "1px solid #f1f5f9" }}>
                {(opt.pros || []).map((p, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#1a7a4a", padding: "3px 0", display: "flex", gap: 6 }}>
                    <span>+</span><span>{p}</span>
                  </div>
                ))}
                {(opt.cons || []).map((c, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "3px 0", display: "flex", gap: 6 }}>
                    <span>−</span><span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>
        {data.disclaimer}
      </div>
    </div>
  );
};
// ── PolicyTab ──
const PolicyTab = ({ sessionID, policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy, onGoToChat }) => {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const archivedCount = versions.filter(v => !v.is_active).length;
  const filledCount = policy ? FIELDS.filter((f) => policy.policy_data?.[f.key]).length : 0;
  const pct = Math.round((filledCount / FIELDS.length) * 100);
  const startEdit = (f) => { setEditingKey(f.key); setEditValue(policy?.policy_data?.[f.key] || ""); };
  const cancelEdit = () => { setEditingKey(null); setEditValue(""); };

  const saveField = useCallback(async (fieldKey, value) => {
    if (!String(value).trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/policy/${sessionID}/field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldKey, value: String(value).trim() }),
      });
      setSavedKey(fieldKey);
      setTimeout(() => setSavedKey(null), 1800);
      await fetchPolicy();
    } catch (err) { console.error("Save error:", err); }
    finally { setSaving(false); setEditingKey(null); setEditValue(""); }
  }, [fetchPolicy, sessionID]);

  const handleKeyDown = (e, fieldKey) => {
    if (e.key === "Enter") saveField(fieldKey, editValue);
    if (e.key === "Escape") cancelEdit();
  };

  const handleOpenHistory = () => { fetchVersions(); setShowHistory(true); };

  return (
    <div className="scroll-hide" style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f8fafc", position: "relative" }}>

      {/* History overlay */}
      {showHistory && (

        <HistoryDrawer versions={versions} onClose={() => setShowHistory(false)} />
      )}
      {showDecision && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
          <DecisionPanel sessionId={sessionID} onClose={() => setShowDecision(false)} />
        </div>
      )}
      {/* Progress bar */}
      {policy && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1a4a7a" }}>
              Form Progress — {filledCount}/{FIELDS.length}
            </span>
            {policy.complete
              ? <span style={{ fontSize: 11, background: "#e8f8f0", color: "#1a7a4a", padding: "2px 8px", borderRadius: 20, border: "1px solid #b8e8d0" }}>✅ Complete</span>
              : <span style={{ fontSize: 11, color: "#94a3b8" }}>v{policy.version ?? 1}</span>
            }
          </div>
          <div style={{ height: 5, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#0f3460,#2c6fad)", borderRadius: 4, transition: "width .4s" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={async () => {
            await fetchPolicy();
            await fetchVersions();
          }}
          disabled={loading}
          style={{
            flex: 1,
            padding: "7px",
            fontSize: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 7,
            background: loading ? "#f1f5f9" : "#fff",
            color: loading ? "#94a3b8" : "#1a4a7a",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all .2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <span style={{
            display: "inline-block",
            animation: loading ? "spin 1s linear infinite" : "none",
          }}>
            ↻
          </span>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {archivedCount > 0 && (
          <button onClick={handleOpenHistory}
            style={{ padding: "7px 10px", fontSize: 12, border: "1px solid #c7d2fe", borderRadius: 7, background: "#eef2ff", color: "#4338ca", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            📂 <span style={{ fontWeight: 600 }}>{archivedCount}</span>
          </button>
        )}

        {policy?.complete && (
          <button onClick={() => setShowDecision(true)}
            style={{ flex: 1, padding: "7px", fontSize: 12, border: "1px solid #b8d8f0", borderRadius: 7, background: "#e6f1fb", color: "#1a4a7a", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            Analyze Policy
          </button>
        )}

        <button
          onClick={() => {
            if (window.confirm("Start a new blank form?\n\nYour current data stays saved in history — nothing is deleted."))
              resetPolicy();
          }}
          style={{ padding: "7px 12px", fontSize: 12, border: "1px solid #fde68a", borderRadius: 7, background: "#fffbeb", color: "#92400e", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          + New
        </button>
      </div>

      {policy && (
        <div style={{ fontSize: 11, color: "#64748b", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "6px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
          ✏️ Tap any field below to fill or edit it directly
        </div>
      )}

      {FIELDS.map((f) => {
        const val = policy?.policy_data?.[f.key];
        const filled = !!val;
        const isEditing = editingKey === f.key;
        const justSaved = savedKey === f.key;

        return (
          <div key={f.key} style={{
            marginBottom: 8, background: "#fff",
            border: `1px solid ${isEditing ? "#2c6fad" : filled ? "#b8d8f0" : "#e2e8f0"}`,
            borderRadius: 8, overflow: "hidden",
            transition: "border-color .15s, box-shadow .15s",
            boxShadow: isEditing ? "0 0 0 3px rgba(44,111,173,0.12)" : "none",
          }}>
            <div
              onClick={() => !isEditing && startEdit(f)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: isEditing ? "default" : "pointer" }}
              onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = "#f8faff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18, width: 26, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 2 }}>{f.label}</div>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: filled ? "#0f3460" : isEditing ? "#94a3b8" : "#cbd5e0",
                  fontStyle: filled || isEditing ? "normal" : "italic",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {isEditing ? "Editing…" : filled ? val : "Tap to fill"}
                </div>
              </div>
              <span style={{ fontSize: 14, flexShrink: 0, transition: "color .2s", color: justSaved ? "#1a7a4a" : filled ? "#1a7a4a" : isEditing ? "#2c6fad" : "#cbd5e0" }}>
                {justSaved ? "✓" : filled ? "✓" : isEditing ? "✎" : "○"}
              </span>
            </div>

            {isEditing && (
              <div style={{ padding: "0 12px 12px", borderTop: "1px solid #e2e8f0", background: "#f8faff", animation: "slideDown 0.18s ease-out" }}>
                <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
                <div style={{ marginTop: 10 }}>
                  {f.type === "select" ? (
                    <select autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #bfdbfe", borderRadius: 6, background: "#fff", color: "#0f3460", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                      <option value="">— Select {f.label} —</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input autoFocus type={f.type} value={editValue} placeholder={f.placeholder}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, f.key)}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #bfdbfe", borderRadius: 6, background: "#fff", color: "#0f3460", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                  )}
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                  <button onClick={() => saveField(f.key, editValue)} disabled={!editValue || saving}
                    style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: editValue && !saving ? "#1a4a7a" : "#cbd5e0", color: "#fff", border: "none", borderRadius: 6, cursor: editValue && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background .15s" }}>
                    {saving ? "Saving…" : "✓ Save"}
                  </button>
                  <button onClick={cancelEdit}
                    style={{ padding: "8px 14px", fontSize: 12, background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, textAlign: "center" }}>
                  Press Enter to save · Esc to cancel
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!policy && !loading && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <p style={{ fontSize: 13, marginBottom: 12 }}>No policy data yet.</p>
          <button onClick={onGoToChat}
            style={{ padding: "8px 18px", background: "#1a4a7a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            Start Intake in Chat →
          </button>
        </div>
      )}

      {policy?.missing_fields?.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>Still needed — tap to fill:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {policy.missing_fields.map((fk) => {
              const f = FIELDS.find((x) => x.key === fk);
              return (
                <button key={fk} onClick={() => startEdit(f)}
                  style={{ fontSize: 11, padding: "3px 8px", background: "#fff", border: "1px solid #fcd34d", borderRadius: 20, color: "#92400e", cursor: "pointer", fontFamily: "inherit" }}>
                  {f?.icon} {f?.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
// ── Session helpers ──
const generateNewSessionId = () => {
  const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem("tuto_session_id", newId);
  return newId;
};
// ── App ──
export default function App() {
  const [sessionId, setSessionId] = useState("");
  const wsUrl = `ws://localhost:8000/ws/chat?session_id=${sessionId}`;
  const { status, messages, send } = useWebSocket(wsUrl, sessionId);
  const typing = useTyping(sessionId);
  const { policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy } = usePolicyData(sessionId);

  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [userMessages, setUserMessages] = useState([]);
  const [tab, setTab] = useState("chat");
  const bottomRef = useRef(null);

  const allMessages = [...messages, ...userMessages].sort((a, b) => a.id - b.id);

  const handleFullReset = async () => {
    if (window.confirm("Start a new blank form? Your current data stays saved in history.")) {
      await resetPolicy();
      const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem("tuto_session_id", newId);
      setSessionId(newId);
      setUserMessages([]);
      setTab("chat");
      window.location.reload();
    }
  };

  useEffect(() => {
    let id = localStorage.getItem("tuto_session_id");
    if (!id) id = generateNewSessionId();
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (tab === "policy") {
      fetchPolicy();
      fetchVersions();
    }
  }, [tab]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || status !== "connected") return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setUserMessages(prev => [...prev, { type: "user", text, timestamp: now, id: Date.now() }]);
    send(text);
    setInput("");
    setTimeout(() => fetchPolicy(), 2000);
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "bot" && tab === "policy") {
      fetchPolicy();
    }
  }, [messages]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Source+Sans+3:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: 'Source Sans 3', sans-serif; }
        @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dotB { 0%,80%,100% { opacity:.2; transform:scale(.8); } 40% { opacity:1; transform:scale(1.1); } }
        .scroll-hide::-webkit-scrollbar { width: 5px; }
        .scroll-hide::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
        .tab-btn { flex:1; padding:9px 0; font-size:12.5px; font-family:'Source Sans 3',sans-serif; border:none; background:transparent; cursor:pointer; color:#64748b; font-weight:500; border-bottom:2px solid transparent; transition:all .15s; }
        .tab-btn.active { color:#1a4a7a; border-bottom-color:#1a4a7a; background:#fff; }
        .tab-btn:hover:not(.active) { color:#334155; background:#f8fafc; }
      `}</style>

      <FloatingChatButton
        onClick={() => setChatOpen(prev => !prev)}
        isOpen={chatOpen}
      />

      {/* ── Chat Widget (show/hide) ── */}
      {chatOpen && (
        <div style={{
          position: "fixed", bottom: 90, right: 24,
          width: 420, height: "85vh",
          zIndex: 9997,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
          animation: "fabPop 0.25s ease-out",
        }}>
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 420, height: "85vh", display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", background: "#ffffff", boxShadow: "0 25px 50px -12px rgba(0,0,0,.15)", border: "1px solid #e2e8f0" }}>

              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #0f3460 0%, #1a4a7a 100%)", borderBottom: "3px solid #d4af37", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 4, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📈</div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: "15px", fontFamily: "Lora, serif", letterSpacing: "0.2px" }}>Tell Us The Odds℠</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px" }}>Valuation Services</div>
                  </div>
                </div>
                <StatusDot status={status} />
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#f8fafc" }}>
                <button className={`tab-btn ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>💬 Chat</button>
                <button className={`tab-btn ${tab === "policy" ? "active" : ""}`} onClick={() => setTab("policy")}>📋 My Policy</button>
              </div>

              {tab === "chat" && (
                <>
                  <div style={{ background: "#f0f9ff", borderBottom: "1px solid #e0f2fe", padding: "5px 16px", fontSize: "10.5px", color: "#0369a1", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    ℹ️ Educational guidance only — not financial or legal advice.
                  </div>
                  {allMessages.length === 0 && (
                    <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0, background: "#f8fafc" }}>
                      {[
                        "Start my intake form",
                        "What is my claim probability?",
                        "Which option has the best value?",
                        "What does elimination period mean?",
                        "How does inflation protection work?",
                        "Show all my details",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            setUserMessages(p => [...p, { type: "user", text: q, timestamp: now, id: Date.now() }]);
                            send(q);
                          }}
                          style={{
                            fontSize: 11,
                            padding: "5px 10px",
                            border: "1px solid #bfdbfe",
                            borderRadius: 20,
                            background: "#fff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {q}
                        </button>
                      ))}

                    </div>
                  )}
                  <div className="scroll-hide" style={{ flex: 1, overflowY: "auto", padding: "24px 16px", color: "#334155", background: "#f8fafc" }}>
                    {allMessages.length === 0 && (
                      <div style={{ textAlign: "center", color: "#64748b", marginTop: "30%" }}>
                        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📝</div>
                        <p style={{ fontSize: 14, fontWeight: 500 }}>How can we help with your policy analysis today?</p>
                      </div>
                    )}
                    {allMessages.map((msg) => <Message key={msg.id} msg={msg} isUser={msg.type === "user"} />)}
                    {typing && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </div>
                  <div style={{ padding: "16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, alignItems: "center" }}>
                    <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder="Type your message..." disabled={status !== "connected"}
                      style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #cbd5e0", background: "#fdfdfd", fontSize: "14px", resize: "none", outline: "none", fontFamily: "inherit", color: "#1a202c" }}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || status !== "connected"}
                      style={{ width: 44, height: 44, borderRadius: 8, border: "none", background: input.trim() && status === "connected" ? "#1a4a7a" : "#cbd5e0", color: "#fff", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ➤
                    </button>
                  </div>
                </>
              )}

              {tab === "policy" && (
                <PolicyTab
                  sessionID={sessionId}
                  policy={policy}
                  versions={versions}
                  loading={loading}
                  fetchPolicy={fetchPolicy}
                  fetchVersions={fetchVersions}
                  resetPolicy={handleFullReset}
                  onGoToChat={() => setTab("chat")}
                />
              )}

              <div style={{ padding: "8px", textAlign: "center", fontSize: "10px", color: "#94a3b8", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                Sutter's Mill Valuation Services
              </div>
            </div>
          </div>
        </div>
      )}


    </>
  );
}