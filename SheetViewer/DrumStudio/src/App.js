import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Welcome from './components/Welcome';
import Metronome from './components/Metronome';
import Studio from './components/Studio';
import Records from './components/Records';
import Navigation from './components/Navigation';

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
  sticks: 0,
  isFirstVisit: true,
  lastLoginDate: '',
  practiceRecords: [],
  studioItems: [],
  ownedItems: [],
  rewardsGiven: {},
};

export default function App() {
  const [data, setData] = useState(() => loadData() || { ...DEFAULT_DATA });
  const [page, setPage] = useState('metronome');
  const [showWelcome, setShowWelcome] = useState(false);
  const [rewardPopup, setRewardPopup] = useState(null);

  // persist
  useEffect(() => { saveData(data); }, [data]);

  // daily login & first visit
  useEffect(() => {
    const today = todayStr();
    if (data.isFirstVisit) {
      setShowWelcome(true);
    } else if (data.lastLoginDate !== today) {
      // daily login reward
      giveSticks(1, '매일 접속 보상!');
      setData(prev => ({ ...prev, lastLoginDate: today }));
    }
  }, []); // eslint-disable-line

  const giveSticks = useCallback((amount, message) => {
    setData(prev => ({ ...prev, sticks: prev.sticks + amount }));
    setRewardPopup({ amount, message });
    setTimeout(() => setRewardPopup(null), 2500);
  }, []);

  const handleWelcomeClose = () => {
    const today = todayStr();
    setData(prev => ({
      ...prev,
      isFirstVisit: false,
      lastLoginDate: today,
      sticks: prev.sticks + 1,
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

  const checkTimeReward = useCallback((totalSeconds) => {
    const today = todayStr();
    setData(prev => {
      const rewards = { ...prev.rewardsGiven };
      const todayRewards = rewards[today] || { min10: false, min30: false, hour1: false };
      let sticksToGive = 0;
      let msg = '';

      if (totalSeconds >= 600 && !todayRewards.min10) {
        todayRewards.min10 = true;
        sticksToGive = 2;
        msg = '10분 연습 완료!';
      }
      if (totalSeconds >= 1800 && !todayRewards.min30) {
        todayRewards.min30 = true;
        sticksToGive = 5;
        msg = '30분 연습 완료!';
      }
      if (totalSeconds >= 3600 && !todayRewards.hour1) {
        todayRewards.hour1 = true;
        sticksToGive = 10;
        msg = '1시간 연습 완료!';
      }

      if (sticksToGive > 0) {
        rewards[today] = todayRewards;
        setTimeout(() => giveSticks(sticksToGive, msg), 300);
        return { ...prev, rewardsGiven: rewards };
      }

      rewards[today] = todayRewards;
      return { ...prev, rewardsGiven: rewards };
    });
  }, [giveSticks]);

  const buyItem = useCallback((item) => {
    setData(prev => {
      if (prev.sticks < item.price) return prev;
      if (prev.ownedItems.includes(item.id)) return prev;
      return {
        ...prev,
        sticks: prev.sticks - item.price,
        ownedItems: [...prev.ownedItems, item.id],
      };
    });
  }, []);

  const placeItem = useCallback((itemId, x, y) => {
    setData(prev => {
      const items = prev.studioItems.filter(i => !(i.x === x && i.y === y));
      items.push({ id: itemId, x, y });
      return { ...prev, studioItems: items };
    });
  }, []);

  const removeItem = useCallback((x, y) => {
    setData(prev => ({
      ...prev,
      studioItems: prev.studioItems.filter(i => !(i.x === x && i.y === y)),
    }));
  }, []);

  return (
    <div className="app">
      {showWelcome && <Welcome onClose={handleWelcomeClose} />}

      {rewardPopup && (
        <div className="reward-popup">
          <div>{rewardPopup.message}</div>
          <div className="reward-sticks">+{rewardPopup.amount} 🥢</div>
        </div>
      )}

      <div className="header">
        <h1>🥁 DrumStudio</h1>
        <div className="stick-display">🥢 {data.sticks}</div>
      </div>

      <div className="page-content">
        {page === 'metronome' && (
          <Metronome
            onSaveRecord={addPracticeRecord}
            onCheckTimeReward={checkTimeReward}
          />
        )}
        {page === 'studio' && (
          <Studio
            sticks={data.sticks}
            ownedItems={data.ownedItems}
            studioItems={data.studioItems}
            onBuy={buyItem}
            onPlace={placeItem}
            onRemove={removeItem}
          />
        )}
        {page === 'records' && (
          <Records records={data.practiceRecords} />
        )}
      </div>

      <Navigation current={page} onChange={setPage} />
    </div>
  );
}
