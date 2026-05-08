export const FIELDS = [
  { key: "name", label: "Full Name", icon: "👤", type: "text", placeholder: "e.g. John Roy" },
  { key: "age", label: "Age", icon: "🎂", type: "number", placeholder: "e.g. 55" },
  { key: "policy_type", label: "Policy Type", icon: "📋", type: "select", options: ["Traditional", "Hybrid", "Annuity", "Chronic illness rider"] },
  { key: "premium", label: "Monthly Premium ($)", icon: "💰", type: "number", placeholder: "e.g. 250" },
  { key: "benefit_amount", label: "Benefit Amount ($)", icon: "🏥", type: "number", placeholder: "e.g. 5000" },
  { key: "elimination_period", label: "Elimination Period", icon: "⏳", type: "select", options: ["30 days", "60 days", "90 days", "180 days"] },
  { key: "inflation_protection", label: "Inflation Protection", icon: "📈", type: "select", options: ["None", "3% compound", "5% compound", "CPI-linked"] },
];

export const DECISION_COLORS = {
  keep: { border: "#1a7a4a", badge: "#e8f8f0", badgeText: "#1a7a4a", label: "Stay Protected" },
  lapse: { border: "#92400e", badge: "#fffbeb", badgeText: "#92400e", label: "Stop & Walk Away" },
  sell: { border: "#1a4a7a", badge: "#e6f1fb", badgeText: "#1a4a7a", label: "Cash Out" },
};