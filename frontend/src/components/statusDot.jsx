
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  connected:    { color: "#22c55e", label: "Connected" },
  connecting:   { color: "#eab308", label: "Connecting" },
  disconnected: { color: "#ef4444", label: "Disconnected" },
  error:        { color: "#ef4444", label: "Error" },
};

export const StatusDot = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <Badge
      variant="outline"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 20,
        padding: "4px 10px",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {cfg.label}
      </span>
    </Badge>
  );
};