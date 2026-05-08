import { useState } from "react";

export const FloatingChatButton = ({ onClick, isOpen }) => {
  const [showLabel, setShowLabel] = useState(true);

  return (
    <>
      <style>{`
        @keyframes fabPop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .fab-btn { transition: transform 0.2s, background 0.2s; }
        .fab-btn:hover { transform: scale(1.08) !important; background: #1a4a7a !important; }
      `}</style>

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