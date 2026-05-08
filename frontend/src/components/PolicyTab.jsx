import { useState, useCallback } from "react";
import { FIELDS } from "../constants/fileds";
import { HistoryDrawer } from "./HistoryDrawer";
import { DecisionPanel } from "./DecisionPanel";
import { API } from "../firebase/config";

export const PolicyTab = ({ sessionID, policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy, onGoToChat }) => {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  
  const archivedCount = versions.filter(v => !v.is_active).length;
  const filledCount = policy ? FIELDS.filter((f) => policy.policy_data?.[f.key]).length : 0;
  const pct = Math.round((filledCount / FIELDS.length) * 100);
  
  const startEdit = (f) => { 
    setEditingKey(f.key); 
    setEditValue(policy?.policy_data?.[f.key] || ""); 
  };
  
  const cancelEdit = () => { 
    setEditingKey(null); 
    setEditValue(""); 
  };

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
    } catch (err) { 
      console.error("Save error:", err); 
    } finally { 
      setSaving(false); 
      setEditingKey(null); 
      setEditValue(""); 
    }
  }, [fetchPolicy, sessionID]);

  const handleKeyDown = (e, fieldKey) => {
    if (e.key === "Enter") saveField(fieldKey, editValue);
    if (e.key === "Escape") cancelEdit();
  };

  const handleOpenHistory = () => { 
    fetchVersions(); 
    setShowHistory(true); 
  };

  return (
    <div className="scroll-hide" style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f8fafc", position: "relative" }}>
      {showHistory && <HistoryDrawer versions={versions} onClose={() => setShowHistory(false)} />}
      {showDecision && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
          <DecisionPanel sessionId={sessionID} onClose={() => setShowDecision(false)} />
        </div>
      )}
      
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
          <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
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