import { useState } from 'react';
import Answer from './components/answer';
import CodePage from './components/code';
import ImagesPage from './components/images';
import './App.css';

function App() {
  const [view, setView] = useState('answer'); // 'answer' or 'code'

  if (view === 'code') {
    return <CodePage onNavBack={() => setView('answer')} />;
  }

  if (view === 'images') {
    return <ImagesPage onNavBack={() => setView('answer')} />;
  }

  return <Answer onNavCode={() => setView('code')} onNavImages={() => setView('images')} />;
}

export default App;
