import { useState } from "react";
import { FIELDS } from "../constants/fileds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export const HistoryDrawer = ({ versions, onClose }) => {
  const [expanded, setExpanded] = useState(null);
  const archived = versions.filter((v) => !v.is_active);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", fontFamily: "'DM Sans', sans-serif" }}>
            📂 Policy History
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>
            {archived.length} previous {archived.length === 1 ? "policy" : "policies"} — read only
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onClose}
          style={{ width: 30, height: 30, borderRadius: 8, padding: 0, fontSize: 14, color: "#64748b", border: "1px solid #e2e8f0" }}
        >
          ✕
        </Button>
      </div>

      
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {archived.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", paddingTop: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
              <p style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No previous policies yet.</p>
            </div>
          )}

          {archived.map((v) => {
            const name = v.policy_data?.name || "Unnamed";
            const pType = v.policy_data?.policy_type || "—";
            const date = v.created_at
              ? new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "";
            const hPct = Math.round((v.filled_count / 7) * 100);
            const isOpen = expanded === v.version;

            return (
              <Card key={v.version} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "none" }}>
                {/* Version row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : v.version)}
                  style={{ padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "background 0.12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f8faff"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4338ca", flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    v{v.version}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>
                      {pType} · {date}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <Badge style={{ fontSize: 10, fontWeight: 600, background: hPct === 100 ? "#f0fdf4" : "#f8fafc", color: hPct === 100 ? "#1a7a4a" : "#64748b", border: `1px solid ${hPct === 100 ? "#bbf7d0" : "#e2e8f0"}`, fontFamily: "'DM Sans', sans-serif" }}>
                      {v.filled_count}/7
                    </Badge>
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 2, background: "#e2e8f0", margin: "0 14px" }}>
                  <div style={{ height: "100%", width: `${hPct}%`, background: hPct === 100 ? "#1a7a4a" : "linear-gradient(90deg,#6366f1,#818cf8)", borderRadius: 2, transition: "width 0.3s" }} />
                </div>

                {/* Expanded fields */}
                {isOpen && (
                  <CardContent className="tuto-slide" style={{ padding: "10px 14px 12px", borderTop: "1px solid #f1f5f9" }}>
                    {FIELDS.map((f) => {
                      const val = v.policy_data?.[f.key];
                      return (
                        <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
                          <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8", width: 110, flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>{f.label}</span>
                          <span style={{ fontSize: 12, fontWeight: val ? 500 : 400, color: val ? "#0f3460" : "#cbd5e0", fontStyle: val ? "normal" : "italic", fontFamily: "'DM Sans', sans-serif" }}>
                            {val || "—"}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                      🔒 Read only — archived policy
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
    </div>
  );
};