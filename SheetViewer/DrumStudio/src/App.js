import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Welcome from './components/Welcome';
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
  practiceRecords: [],
};

export default function App() {
  const [data, setData] = useState(() => loadData() || { ...DEFAULT_DATA });
  const [showWelcome, setShowWelcome] = useState(false);

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
  };

  const addPracticeRecord = useCallback((record) => {
    const today = todayStr();
    setData(prev => {
      const records = [...prev.practiceRecords];
      const dayIdx = records.findIndex(r => r.date === today);
      if (dayIdx >= 0) {
        records[dayIdx] = {
          ...records[dayIdx],
          sessions: [...records[dayIdx].sessions, record],
        };
      } else {
        records.push({ date: today, sessions: [record] });
      }
      return { ...prev, practiceRecords: records };
    });
  }, []);

  return (
    <div className="app">
      {showWelcome && <Welcome onClose={handleWelcomeClose} />}

      <div className="header">
        <h1>🥁 DrumStudio</h1>
      </div>

      <div className="page-content">
        <Metronome onSaveRecord={addPracticeRecord} />
      </div>
    </div>
  );
}
