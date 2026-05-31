import React, { useState } from 'react';
import './App.css';
import Welcome from './components/Welcome';
import Tutorial from './components/Tutorial';
import Metronome from './components/Metronome';

const APP_VERSION = process.env.REACT_APP_VERSION;
const STORAGE_KEY = 'drumStudioLastSeenVersion';

export default function App() {
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== APP_VERSION
  );
  const [showTutorial, setShowTutorial] = useState(false);

  const handleWelcomeClose = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    setShowWelcome(false);
    setShowTutorial(true);
  };

  return (
    <div className="app">
      {showWelcome && <Welcome onClose={handleWelcomeClose} version={APP_VERSION} />}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      <div className="header">
        <h1>
          <span className="header-icon">🥁</span>
          <span className="header-text">DrumStudio</span>
        </h1>
      </div>

      <div className="page-content">
        <Metronome />
      </div>
    </div>
  );
}
