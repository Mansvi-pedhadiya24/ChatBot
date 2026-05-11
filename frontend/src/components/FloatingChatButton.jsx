import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const FloatingChatButton = ({ onClick, isOpen }) => {
  const [showLabel, setShowLabel] = useState(true);

  return (
    <>
      {/* Tooltip label */}
      {showLabel && !isOpen && (
        <Card
          style={{
            position: "fixed", bottom: 34, right: 90,
            zIndex: 9998, padding: "6px 14px",
            borderRadius: 20, border: "1px solid #e2e8f0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            display: "flex", alignItems: "center", gap: 8,
            animation: "fabPop 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: 13, color: "#334155", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
            Free to Ask
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setShowLabel(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8", padding: 0, lineHeight: 1 }}
            aria-label="Dismiss tooltip"
          >
            ✕
          </button>
        </Card>
      )}

      {/* FAB */}
      <Button
        onClick={onClick}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: "50%",
          background: "#0f3460", border: "none",
          boxShadow: "0 6px 20px rgba(15,52,96,0.4)",
          zIndex: 9999, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color: "#fff",
          transition: "transform 0.2s, background 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.background = "#1a4a7a"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "#0f3460"; }}
      >
        {isOpen ? "✕" : "💬"}

        {/* Unread badge */}
        {!isOpen && (
          <Badge
            style={{
              position: "absolute", top: 2, right: 2,
              width: 16, height: 16, padding: 0,
              borderRadius: "50%", background: "#c9a227",
              border: "2px solid #fff",
              fontSize: 8, fontWeight: 700, color: "#7a4e00",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            1
          </Badge>
        )}
      </Button>
    </>
  );
};