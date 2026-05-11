import { useState, useEffect } from "react";
import { API } from "../firebase/config";
import { DECISION_COLORS } from "../constants/fileds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const DecisionPanel = ({ sessionId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/policy/${sessionId}/decision`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Could not load analysis."); setLoading(false); });
  }, [sessionId]);

  if (loading)
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>↻</span>
        Analyzing your policy…
      </div>
    );

  if (error)
    return <div style={{ padding: 32, textAlign: "center", color: "#e74c3c", fontFamily: "'DM Sans', sans-serif" }}>{error}</div>;

  if (!data?.options)
    return <div style={{ padding: 32, textAlign: "center", color: "#e74c3c", fontFamily: "'DM Sans', sans-serif" }}>No analysis data returned.</div>;

  const recommended = (data?.recommended || "keep").toLowerCase();
  const recColor = DECISION_COLORS[recommended] || DECISION_COLORS["keep"];
  const finalAnswer = data?.final_answer || `Recommendation: ${recColor.label}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Panel header */}
      <div style={{ padding: "13px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#fff" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", fontFamily: "'DM Sans', sans-serif" }}>
            Policy Decision Analysis
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
            Educational only — not financial advice
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

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Recommendation summary */}
          <Card style={{
            border: `1.5px solid ${recColor.border}`,
            background: "#eff6ff", boxShadow: "none", borderRadius: 12,
          }}>
            <CardContent style={{ padding: "11px 14px" }}>
              <p style={{ fontSize: 13, color: recColor.border, fontWeight: 600, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                {finalAnswer}
              </p>
            </CardContent>
          </Card>

          {/* Options */}
          {["keep", "lapse", "sell"].map((key) => {
            const opt = data.options[key];
            const color = DECISION_COLORS[key];
            const isRec = key === recommended;
            if (!opt) return null;

            return (
              <Card
                key={key}
                style={{
                  border: isRec ? `2px solid ${color.border}` : "1px solid #e2e8f0",
                  borderRadius: 12, boxShadow: "none",
                  opacity: isRec ? 1 : 0.72,
                  overflow: "hidden",
                }}
              >
                <CardContent style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f3460", fontFamily: "'DM Sans', sans-serif" }}>
                          {opt.label}
                        </span>
                        {isRec && (
                          <Badge style={{ fontSize: 9, background: color.badge, color: color.badgeText, borderRadius: 10, padding: "2px 7px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", border: "none" }}>
                            RECOMMENDED
                          </Badge>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{opt.summary}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: color.badgeText, fontFamily: "'DM Sans', sans-serif" }}>{opt.score}</div>
                      <div style={{ width: 48, height: 4, background: "#e2e8f0", borderRadius: 4, marginTop: 3 }}>
                        <div style={{ width: `${opt.score}%`, height: "100%", background: color.border, borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>

                  {/* Pros & cons for recommended */}
                  {isRec && (opt.pros?.length > 0 || opt.cons?.length > 0) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                      {(opt.pros || []).map((p, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#1a7a4a", padding: "3px 0", display: "flex", gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
                          <span>+</span><span>{p}</span>
                        </div>
                      ))}
                      {(opt.cons || []).map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "3px 0", display: "flex", gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
                          <span>−</span><span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <p style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
            {data.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};