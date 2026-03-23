import React from 'react';

const TABS = [
  { id: 'metronome', icon: '🥁', label: '연습' },
  { id: 'studio',    icon: '🏠', label: '스튜디오' },
  { id: 'records',   icon: '📊', label: '기록' },
];

export default function Navigation({ current, onChange }) {
  return (
    <div className="nav-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={'nav-btn' + (current === tab.id ? ' active' : '')}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
