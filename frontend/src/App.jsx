import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom'; // Aa line add karo
import AskAiPage from './AskAi';

function App() {
  return (
    <Routes>
      <Route path="/AskAi" element={<AskAiPage />} />
    </Routes>
  );
}

export default App;