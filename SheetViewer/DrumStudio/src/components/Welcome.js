import React from 'react';

export default function Welcome({ onClose }) {
  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-box" onClick={e => e.stopPropagation()}>
        <h1 className="welcome-title">이 세상 모든 드러머를<br />그리고 당신을 위하여</h1>
        <p className="welcome-note">이어폰 사용을 권장합니다.</p>
        <button className="pixel-btn green" onClick={onClose}>
          시작하기!
        </button>
        <p className="welcome-version">v1.0.0</p>
      </div>
    </div>
  );
}
