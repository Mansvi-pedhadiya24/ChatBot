import { Card } from "@/components/ui/card";

const formatText = (text) =>
  String(text)
    .split(/(\*\*[^*]+\*\*)/)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );

export const Message = ({ msg, isUser }) => {
  return (
    <div
      className="tuto-msg"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div style={{ maxWidth: "82%" }}>
        {isUser ? (
          /* User bubble — no Card, just a styled div */
          <div
            style={{
              padding: "11px 15px",
              borderRadius: "14px 14px 3px 14px",
              background: "#0f3460",
              color: "#fff",
              fontSize: 13.5,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {msg.text}
          </div>
        ) : (
          /* Bot bubble — shadcn Card */
          <Card
            style={{
              padding: "11px 15px",
              borderRadius: "14px 14px 14px 3px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "none",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "#1e293b",
              whiteSpace: "pre-wrap",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {formatText(msg.text)}
          </Card>
        )}

        <div
          style={{
            fontSize: 10,
            color: "#94a3b8",
            marginTop: 3,
            textAlign: isUser ? "right" : "left",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {msg.timestamp}
        </div>
      </div>
    </div>
  );
};