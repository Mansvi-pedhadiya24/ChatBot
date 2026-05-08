import { useState } from "react";
import { FIELDS } from "../constants/fileds";

export const HistoryDrawer = ({ versions, onClose }) => {
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