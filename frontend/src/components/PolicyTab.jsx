import { useState, useCallback } from "react";
import { FIELDS } from "../constants/fileds";
import { HistoryDrawer } from "./HistoryDrawer";
import { DecisionPanel } from "./DecisionPanel";
import { API } from "../firebase/config";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const PolicyTab = ({
  sessionID, policy, versions, loading,
  fetchPolicy, fetchVersions, resetPolicy, onGoToChat,
}) => {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDecision, setShowDecision] = useState(false);

  const archivedCount = versions.filter((v) => !v.is_active).length;
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

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
      {showHistory && <HistoryDrawer versions={versions} onClose={() => setShowHistory(false)} />}
      {showDecision && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "#f8fafc" }}>
          <DecisionPanel sessionId={sessionID} onClose={() => setShowDecision(false)} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Progress card */}
          {policy && (
            <Card style={{ border: "1px solid #e2e8f0", boxShadow: "none", borderRadius: 12 }}>
              <CardContent style={{ padding: "13px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1a4a7a", fontFamily: "'DM Sans', sans-serif" }}>
                    Form Progress — {filledCount}/{FIELDS.length}
                  </span>
                  {policy.complete ? (
                    <Badge style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                      ✅ Complete
                    </Badge>
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>v{policy.version ?? 1}</span>
                  )}
                </div>
                <div style={{ height: 5, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#0f3460,#2c6fad)", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="outline"
              onClick={async () => { await fetchPolicy(); await fetchVersions(); }}
              disabled={loading}
              style={{
                flex: 1, fontSize: 12, height: 36, borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif",
                border: "1px solid #e2e8f0", color: loading ? "#94a3b8" : "#1a4a7a",
              }}
            >
              <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none", marginRight: 5 }}>↻</span>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>

            {archivedCount > 0 && (
              <Button
                variant="outline"
                onClick={() => { fetchVersions(); setShowHistory(true); }}
                style={{ fontSize: 12, height: 36, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", gap: 4 }}
              >
                📂 <Badge style={{ background: "#4338ca", color: "#fff", fontSize: 10, borderRadius: 10, padding: "1px 6px" }}>{archivedCount}</Badge>
              </Button>
            )}

            {policy?.complete && (
              <Button
                onClick={() => setShowDecision(true)}
                style={{
                  flex: 1, fontSize: 12, height: 36, borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  background: "#0f3460", color: "#fff", border: "1.5px solid #c9a227",
                  fontWeight: 600,
                }}
              >
                ✦ Analyze
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm("Start a new blank form?\n\nYour current data stays saved in history — nothing is deleted."))
                  resetPolicy();
              }}
              style={{ fontSize: 12, height: 36, borderRadius: 8, fontFamily: "'DM Sans', sans-serif", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontWeight: 600 }}
            >
              + New
            </Button>
          </div>

          {/* Tip banner */}
          {policy && (
            <div style={{ fontSize: 11, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "7px 11px", display: "flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
              ✏️ Tap any field below to fill or edit it directly
            </div>
          )}

          {/* Fields */}
          {FIELDS.map((f) => {
            const val = policy?.policy_data?.[f.key];
            const filled = !!val;
            const isEditing = editingKey === f.key;
            const justSaved = savedKey === f.key;

            return (
              <Card
                key={f.key}
                style={{
                  borderRadius: 10, overflow: "hidden", boxShadow: "none",
                  border: `${isEditing ? "2px" : "1px"} solid ${isEditing ? "#2c6fad" : filled ? "#b8d8f0" : "#e2e8f0"}`,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: isEditing ? "0 0 0 3px rgba(44,111,173,0.1)" : "none",
                }}
              >
                {/* Field row */}
                <div
                  onClick={() => !isEditing && startEdit(f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 13px", cursor: isEditing ? "default" : "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = "#f8faff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 18, width: 26, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>{f.label}</div>
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: filled ? "#0f3460" : isEditing ? "#94a3b8" : "#cbd5e0",
                      fontStyle: filled || isEditing ? "normal" : "italic",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {isEditing ? "Editing…" : filled ? val : "Tap to fill"}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, flexShrink: 0, color: justSaved ? "#1a7a4a" : filled ? "#1a7a4a" : isEditing ? "#2c6fad" : "#cbd5e0" }}>
                    {justSaved ? "✓" : filled ? "✓" : isEditing ? "✎" : "○"}
                  </span>
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div className="tuto-slide" style={{ padding: "0 13px 13px", borderTop: "1px solid #e2e8f0", background: "#f8faff" }}>
                    <div style={{ marginTop: 10 }}>
                      {f.type === "select" ? (
                        <select
                          autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            width: "100%", padding: "9px 12px", fontSize: 13,
                            border: "1px solid #bfdbfe", borderRadius: 8, background: "#fff",
                            color: "#0f3460", fontFamily: "'DM Sans', sans-serif",
                            outline: "none", cursor: "pointer",
                          }}
                        >
                          <option value="">— Select {f.label} —</option>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          autoFocus type={f.type} value={editValue} placeholder={f.placeholder}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, f.key)}
                          style={{
                            width: "100%", padding: "9px 12px", fontSize: 13,
                            border: "1px solid #bfdbfe", borderRadius: 8, background: "#fff",
                            color: "#0f3460", fontFamily: "'DM Sans', sans-serif",
                            outline: "none", boxSizing: "border-box",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                      <Button
                        onClick={() => saveField(f.key, editValue)}
                        disabled={!editValue || saving}
                        style={{
                          flex: 1, height: 34, fontSize: 12, fontWeight: 600, borderRadius: 7,
                          fontFamily: "'DM Sans', sans-serif",
                          background: editValue && !saving ? "#0f3460" : "#cbd5e0",
                          color: "#fff", border: "none",
                        }}
                      >
                        {saving ? "Saving…" : "✓ Save"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={cancelEdit}
                        style={{ height: 34, fontSize: 12, borderRadius: 7, fontFamily: "'DM Sans', sans-serif", border: "1px solid #e2e8f0", color: "#64748b" }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                      Press Enter to save · Esc to cancel
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Empty state */}
          {!policy && !loading && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <p style={{ fontSize: 13, marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>No policy data yet.</p>
              <Button
                onClick={onGoToChat}
                style={{ background: "#0f3460", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", height: 36, padding: "0 18px" }}
              >
                Start Intake in Chat →
              </Button>
            </div>
          )}

          {/* Missing fields */}
          {policy?.missing_fields?.length > 0 && (
            <Card style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 10, boxShadow: "none" }}>
              <CardContent style={{ padding: "10px 13px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                  Still needed — tap to fill:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {policy.missing_fields.map((fk) => {
                    const f = FIELDS.find((x) => x.key === fk);
                    return (
                      <Badge
                        key={fk}
                        onClick={() => startEdit(f)}
                        style={{
                          cursor: "pointer", fontSize: 11, padding: "4px 10px",
                          background: "#fff", border: "1px solid #fcd34d",
                          color: "#92400e", borderRadius: 20,
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                        }}
                      >
                        {f?.icon} {f?.label}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
};