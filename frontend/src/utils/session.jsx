export const generateNewSessionId = () => {
  const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem("tuto_session_id", newId);
  return newId;
};