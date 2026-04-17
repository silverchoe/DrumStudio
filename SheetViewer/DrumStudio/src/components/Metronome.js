import React, { useRef, useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { useMetronome } from '../hooks/useMetronome';
import { useMic } from '../hooks/useMic';
import { BEATS_PER_MEASURE, SUBDIVISIONS } from '../constants';

export default function Metronome() {
  const metronome = useMetronome();
  const mic = useMic({
    audioCtxRef: metronome.audioCtxRef,
    lastTickTimesRef: metronome.lastTickTimesRef,
    nextBeatTimeRef: metronome.nextBeatTimeRef,
    playing: metronome.playing,
  });

  const captureRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const start = useCallback(async () => {
    if (!mic.micReady) {
      await mic.startMic();
    }
    mic.resetAccuracy();
    await metronome.startScheduler();
  }, [mic, metronome]);

  const stop = useCallback(() => {
    metronome.stopScheduler();
  }, [metronome]);

  const handleCapture = useCallback(async () => {
    if (!captureRef.current) return;
    setIsCapturing(true);
    await new Promise(r => requestAnimationFrame(r));
    try {
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#ffffff', scale: 4 });
      const fileName = `drumstudio_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getRank = (acc) => {
    if (acc >= 80) return { stars: '★★★', title: '당신은 드럼의 신' };
    if (acc >= 50) return { stars: '★★', title: '당신은 이미 드러머' };
    if (acc >= 30) return { stars: '★', title: '할 수 있다. 해보자.' };
    return { stars: '', title: '마이크 체크해 보세요.' };
  };

  const feedbackClass = mic.feedback
    ? mic.feedback.score >= 100 ? 'perfect'
    : mic.feedback.score >= 85 ? 'great'
    : mic.feedback.score >= 60 ? 'good'
    : 'miss'
    : '';

  const volColor = mic.volume > 70 ? '#43A047' : mic.volume > 40 ? '#1E88E5' : '#90CAF9';
  const rank = getRank(mic.accuracy);

  return (
    <div className="metronome-section">
      {/* BPM Control */}
      <div className="card">
        <div className="bpm-area">
          <button
            className="pixel-btn blue"
            onClick={() => metronome.setBpm(Math.max(40, metronome.bpm - 5))}
          >-5</button>
          <div>
            <div className="bpm-value">{metronome.bpm}</div>
            <div className="bpm-label">BPM</div>
          </div>
          <button
            className="pixel-btn blue"
            onClick={() => metronome.setBpm(Math.min(200, metronome.bpm + 5))}
          >+5</button>
        </div>

        <div className="bpm-slider-wrap">
          <input
            type="range"
            className="bpm-slider"
            min="40"
            max="200"
            value={metronome.bpm}
            onChange={e => metronome.setBpm(+e.target.value)}
          />
          <div className="slider-labels">
            <span>40</span>
            <span>Slow</span>
            <span>Medium</span>
            <span>Fast</span>
            <span>200</span>
          </div>
        </div>
      </div>

      {/* Beat Indicators + Subdivision + Timer */}
      <div className="card">
        <div className="subdiv-row">
          {SUBDIVISIONS.map(s => (
            <button
              key={s.id}
              className={'subdiv-btn' + (metronome.subdivision === s.sub ? ' active' : '')}
              onClick={() => metronome.setSubdivision(s.sub)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="beat-indicators">
          {Array.from({ length: BEATS_PER_MEASURE }).map((_, beatIdx) => (
            <div key={beatIdx} className="beat-group">
              {Array.from({ length: metronome.subdivision }).map((_, subIdx) => {
                const isActive = metronome.currentBeat === beatIdx && metronome.currentSubBeat === subIdx;
                const isMainBeat = subIdx === 0;
                const isAccent = beatIdx === 0 && subIdx === 0;

                return (
                  <div
                    key={subIdx}
                    className={
                      'beat-ind' +
                      (isMainBeat ? ' main' : ' sub') +
                      (isAccent ? ' accent' : '') +
                      (isActive ? ' active' : '')
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="timer-display" style={{ textAlign: 'center' }}>
          {formatTime(metronome.elapsed)}
        </div>

        <div className="controls-row">
          {!metronome.playing ? (
            <button className="pixel-btn green" onClick={start}>
              ▶ 시작
            </button>
          ) : (
            <button className="pixel-btn blue" onClick={stop}>
              ■ 정지
            </button>
          )}
        </div>
      </div>

      {/* 마이크 & 소리 감지 영역 */}
      <div className="card">
        <div className="mic-status-area">
          {!mic.micReady ? (
            <div className="mic-off-box">
              <button className="mic-big-btn pixel-btn blue" onClick={mic.startMic}>
                <span className="mic-big-icon">🎙️</span>
                <span>마이크 켜기</span>
              </button>
              {mic.micError && (
                <div className="mic-error">{mic.micError}</div>
              )}
            </div>
          ) : (
            <>
              {mic.feedback && (
                <div className={`tap-feedback ${feedbackClass}`}>
                  {mic.feedback.label}
                </div>
              )}

              <div className="vol-meter-wrap">
                <div className="vol-meter-label">🔊 입력 레벨</div>
                <div className="vol-meter-bg">
                  <div
                    className="vol-meter-fill"
                    style={{ width: `${mic.volume}%`, background: volColor }}
                  />
                </div>
                <div className="vol-meter-val">{mic.volume}%</div>
              </div>

              <div className="sensitivity-wrap">
                <div className="vol-meter-label">🎚️ 감도</div>
                <input
                  type="range"
                  className="bpm-slider"
                  min="10"
                  max="95"
                  value={mic.sensitivity}
                  onChange={e => mic.setSensitivity(+e.target.value)}
                  style={{ height: 8 }}
                />
                <div className="sensitivity-labels">
                  <span>둔감</span>
                  <span>민감</span>
                </div>
              </div>

              <div className="mic-off-wrap">
                <button className="pixel-btn gray mic-off-btn" onClick={mic.stopMic}>
                  🎙️ 마이크 끄기
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stats (캡처 영역) */}
        <div ref={captureRef}>
          {isCapturing && (
            <>
              <div className="capture-header">
                {rank.stars && <div className="capture-stars">{rank.stars}</div>}
                <div className="capture-title">{rank.title}</div>
              </div>
              <div className="capture-timer">{formatTime(metronome.elapsed)}</div>
            </>
          )}
          <div className="stats-row stats-row-spaced">
            <div className="stat-box">
              <div className="stat-val">{mic.accuracy}%</div>
              <div className="stat-label">정확도</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{mic.totalTaps}</div>
              <div className="stat-label">히트 수</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{metronome.bpm}</div>
              <div className="stat-label">BPM</div>
            </div>
          </div>
        </div>
        <div className="capture-btn-wrap">
          <button className="pixel-btn green capture-btn" onClick={handleCapture}>
            📸 결과 캡처하기
          </button>
        </div>
      </div>
    </div>
  );
}
