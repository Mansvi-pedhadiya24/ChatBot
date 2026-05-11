import { Card } from "@/components/ui/card";

export const TypingIndicator = () => (
  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
    <Card
      style={{
        padding: "12px 16px",
        borderRadius: "14px 14px 14px 3px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "none",
        display: "inline-flex",
        gap: 5,
        alignItems: "center",
      }}
    >
      {[0, 0.18, 0.36].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#94a3b8", display: "inline-block",
            animation: "dotBounce 1.1s infinite",
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </Card>
  </div>
);