import React, { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useMetronome } from '../hooks/useMetronome';
import { useMic } from '../hooks/useMic';

const BEATS_PER_MEASURE = 4;

const SUBDIVISIONS = [
  { id: '4beat',   label: '4비트',   sub: 1 },
  { id: '8beat',   label: '8비트',   sub: 2 },
  { id: '16beat',  label: '16비트',  sub: 4 },
  { id: 'triplet', label: '3연음',   sub: 3 },
];

export default function Metronome({ onSaveRecord }) {
  const metronome = useMetronome();
  const mic = useMic({
    audioCtxRef: metronome.audioCtxRef,
    lastTickTimesRef: metronome.lastTickTimesRef,
    nextBeatTimeRef: metronome.nextBeatTimeRef,
    playing: metronome.playing,
  });

  // Capture refs
  const captureRef = useRef(null);
  const captureHeaderRef = useRef(null);
  const captureTimerRef = useRef(null);

  const start = useCallback(async () => {
    if (!mic.micReady) {
      await mic.startMic();
    }
    mic.resetAccuracy();
    await metronome.startScheduler();
  }, [mic, metronome]);

  const stop = useCallback(() => {
    metronome.stopScheduler();
    if (metronome.elapsed > 0 && mic.totalTaps > 0) {
      onSaveRecord({
        bpm: metronome.bpm,
        duration: metronome.elapsed,
        accuracy: mic.accuracy,
        taps: mic.totalTaps,
      });
    }
  }, [metronome, mic, onSaveRecord]);

  const handleCapture = useCallback(async () => {
    if (!captureRef.current) return;
    if (captureHeaderRef.current) captureHeaderRef.current.style.display = 'block';
    if (captureTimerRef.current) captureTimerRef.current.style.display = 'block';
    const canvas = await html2canvas(captureRef.current, { backgroundColor: '#ffffff', scale: 4 });
    if (captureHeaderRef.current) captureHeaderRef.current.style.display = 'none';
    if (captureTimerRef.current) captureTimerRef.current.style.display = 'none';
    const fileName = `drumstudio_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const feedbackClass = mic.feedback
    ? mic.feedback.score >= 100 ? 'perfect'
    : mic.feedback.score >= 85 ? 'great'
    : mic.feedback.score >= 60 ? 'good'
    : 'miss'
    : '';

  const volColor = mic.volume > 70 ? '#43A047' : mic.volume > 40 ? '#1E88E5' : '#90CAF9';

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
                <span style={{ fontSize: 32 }}>🎙️</span>
                <span>마이크 켜기</span>
              </button>
              {mic.micError && (
                <div style={{ fontSize: 7, color: '#E53935', marginTop: 8, lineHeight: 1.8 }}>
                  {mic.micError}
                </div>
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

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  className="pixel-btn gray"
                  onClick={mic.stopMic}
                  style={{ fontSize: 7, padding: '6px 12px' }}
                >
                  🎙️ 마이크 끄기
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stats (캡처 영역) */}
        <div ref={captureRef}>
          <div ref={captureHeaderRef} style={{ display: 'none', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
            <div style={{ fontSize: 32, marginBottom: 8, color: '#43A047', textShadow: '1px 1px 0 #1B5E20' }}>★★★</div>
            <div style={{ fontSize: 15, marginBottom: 8, color: '#1E88E5', textShadow: '0.5px 0.5px 0 #0D47A1' }}>당신은 드럼의 신</div>
          </div>
          <div ref={captureTimerRef} style={{ display: 'none', textAlign: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: '#333', marginBottom: 8 }}>
            {formatTime(metronome.elapsed)}
          </div>
          <div className="stats-row" style={{ marginTop: 4 }}>
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
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            className="pixel-btn green"
            onClick={handleCapture}
            style={{ fontSize: 10, padding: '8px 20px', boxShadow: 'none', textShadow: '1px 1px 0 #1B5E20' }}
          >
            📸 결과 캡처하기
          </button>
        </div>
      </div>
    </div>
  );
}
