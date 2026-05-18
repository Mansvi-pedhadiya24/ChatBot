import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom'; 
import AskAiPage from './AskAi';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AskAiPage />} />
    </Routes>
  );
}

export default App;