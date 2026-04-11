import React from 'react';

export default function Welcome({ onClose }) {
  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-box" onClick={e => e.stopPropagation()}>
        <h1 className="welcome-title">이 세상 모든<br />드러머를 위해서</h1>
        <button className="pixel-btn green" onClick={onClose}>
          시작하기!
        </button>
      </div>
    </div>
  );
}
