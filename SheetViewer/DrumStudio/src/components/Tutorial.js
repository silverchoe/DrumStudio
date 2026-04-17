import React from 'react';

export default function Tutorial({ onClose }) {
  return (
    <div className="tutorial-overlay" onClick={onClose}>
      <div className="tutorial-box" onClick={e => e.stopPropagation()}>
        <h2 className="tutorial-title">사용 방법</h2>

        <ul className="tutorial-list">
          <li>
            <span className="tutorial-icon">🎚️</span>
            <div>
              <b>BPM 설정</b>
              <p>슬라이더 또는 +/- 버튼으로 템포를 맞추세요.</p>
            </div>
          </li>
          <li>
            <span className="tutorial-icon">🎙️</span>
            <div>
              <b>마이크 켜기</b>
              <p>드럼 소리를 감지하려면 마이크 권한을 허용하세요.</p>
            </div>
          </li>
          <li>
            <span className="tutorial-icon">▶</span>
            <div>
              <b>연습 시작</b>
              <p>시작 버튼을 누르고 박자에 맞춰 드럼을 쳐보세요.</p>
            </div>
          </li>
          <li>
            <span className="tutorial-icon">📸</span>
            <div>
              <b>결과 캡처</b>
              <p>정확도·히트 수·BPM을 이미지로 저장할 수 있어요.</p>
            </div>
          </li>
        </ul>

        <button className="pixel-btn green tutorial-skip" onClick={onClose}>
          넘어가기
        </button>
      </div>
    </div>
  );
}
