import React from 'react';

export default function Welcome({ onClose }) {
  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-box" onClick={e => e.stopPropagation()}>
        <div className="welcome-icon">🥁</div>
        <h2>DrumStudio</h2>
        <p>
          드럼 연습을 시작해보세요!<br />
          메트로놈에 맞춰 탭하면<br />
          정확도를 체크해줘요.<br />
          연습하면 스틱을 모아<br />
          스튜디오를 꾸밀 수 있어요!
        </p>
        <div className="welcome-reward">
          🎁 환영 선물!<br />
          🥢 × 1 지급!
        </div>
        <button className="pixel-btn green" onClick={onClose}>
          시작하기!
        </button>
      </div>
    </div>
  );
}
