import { useState, useEffect } from "react";
import { API } from "../firebase/config";
import { DECISION_COLORS } from "../constants/fileds";

export const DecisionPanel = ({ sessionId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/policy/${sessionId}/decision`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
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