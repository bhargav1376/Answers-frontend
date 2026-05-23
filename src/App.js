import { useState } from 'react';
import Answer from './components/answer';
import CodePage from './components/code';
import './App.css';

function App() {
  const [view, setView] = useState('answer'); // 'answer' or 'code'

  if (view === 'code') {
    return <CodePage onNavBack={() => setView('answer')} />;
  }

  return <Answer onNavCode={() => setView('code')} />;
}

export default App;
