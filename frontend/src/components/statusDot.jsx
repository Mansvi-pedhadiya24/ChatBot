export const StatusDot = ({ status }) => {
  const colors = { 
    connected: "#2ecc71", 
    connecting: "#f1c40f", 
    disconnected: "#e74c3c", 
    error: "#e74c3c" 
  };
  
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ 
        width: 7, 
        height: 7, 
        borderRadius: "50%", 
        background: colors[status] 
      }} />
      <span style={{ 
        fontSize: 10, 
        color: "rgba(255,255,255,0.8)", 
        fontWeight: 500, 
        textTransform: "uppercase" 
      }}>
        {status}
      </span>
    </div>
  );
};