import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome from './components/Welcome';
import Tutorial from './components/Tutorial';
import Metronome from './components/Metronome';

// ── localStorage helper ──
function loadData() {
  try {
    const raw = localStorage.getItem('drumStudioData');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveData(data) {
  localStorage.setItem('drumStudioData', JSON.stringify(data));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_DATA = {
  isFirstVisit: true,
  lastLoginDate: '',
};

export default function App() {
  const [data, setData] = useState(() => loadData() || { ...DEFAULT_DATA });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // persist
  useEffect(() => { saveData(data); }, [data]);

  // daily login & first visit
  useEffect(() => {
    const today = todayStr();
    if (data.isFirstVisit) {
      setShowWelcome(true);
    } else if (data.lastLoginDate !== today) {
      setData(prev => ({ ...prev, lastLoginDate: today }));
    }
  }, []); // eslint-disable-line

  const handleWelcomeClose = () => {
    const today = todayStr();
    setData(prev => ({
      ...prev,
      isFirstVisit: false,
      lastLoginDate: today,
    }));
    setShowWelcome(false);
    setShowTutorial(true);
  };

  const handleTutorialClose = () => {
    setShowTutorial(false);
  };

  return (
    <div className="app">
      {showWelcome && <Welcome onClose={handleWelcomeClose} />}
      {showTutorial && <Tutorial onClose={handleTutorialClose} />}

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
