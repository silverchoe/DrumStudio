import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useMetronome } from '../hooks/useMetronome';
import { useMic } from '../hooks/useMic';
import {
  BEATS_PER_MEASURE, SUBDIVISIONS,
  BPM_MIN, BPM_MAX, BPM_STEP,
  SENSITIVITY_MIN, SENSITIVITY_MAX,
  RANKS,
  VOLUME_HIGH, VOLUME_MID,
  VOLUME_COLOR_HIGH, VOLUME_COLOR_MID, VOLUME_COLOR_LOW,
} from '../constants';

const cx = (...classes) => classes.filter(Boolean).join(' ');

const getRank = (acc) => RANKS.find(r => acc >= r.minAcc);

const getVolumeColor = (vol) =>
  vol > VOLUME_HIGH ? VOLUME_COLOR_HIGH :
  vol > VOLUME_MID  ? VOLUME_COLOR_MID  :
                      VOLUME_COLOR_LOW;

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Metronome() {
  const metronome = useMetronome();
  const mic = useMic({
    getAudioCtx: metronome.getAudioCtx,
    lastTickTimesRef: metronome.lastTickTimesRef,
    nextBeatTimeRef: metronome.nextBeatTimeRef,
    playing: metronome.playing,
  });

  const captureRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const start = async () => {
    if (!mic.micReady) await mic.startMic();
    mic.resetAccuracy();
    await metronome.startScheduler();
  };

  const handleCapture = async () => {
    if (!captureRef.current) return;
    setIsCapturing(true);
    await new Promise(r => requestAnimationFrame(r));
    try {
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#ffffff', scale: 4 });
      const fileName = `drumstudio_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsCapturing(false);
    }
  };

  const volColor = getVolumeColor(mic.volume);
  const rank = getRank(mic.accuracy);

  return (
    <div className="metronome-section">
      {/* BPM Control */}
      <div className="card">
        <div className="bpm-area">
          <button
            className="pixel-btn blue"
            onClick={() => metronome.setBpm(Math.max(BPM_MIN, metronome.bpm - BPM_STEP))}
          >-{BPM_STEP}</button>
          <div>
            <div className="bpm-value">{metronome.bpm}</div>
            <div className="bpm-label">BPM</div>
          </div>
          <button
            className="pixel-btn blue"
            onClick={() => metronome.setBpm(Math.min(BPM_MAX, metronome.bpm + BPM_STEP))}
          >+{BPM_STEP}</button>
        </div>

        <div className="bpm-slider-wrap">
          <input
            type="range"
            className="bpm-slider"
            min={BPM_MIN}
            max={BPM_MAX}
            value={metronome.bpm}
            onChange={e => metronome.setBpm(+e.target.value)}
          />
          <div className="slider-labels">
            <span>{BPM_MIN}</span>
            <span>Slow</span>
            <span>Medium</span>
            <span>Fast</span>
            <span>{BPM_MAX}</span>
          </div>
        </div>
      </div>

      {/* Beat Indicators + Subdivision + Timer */}
      <div className="card">
        <div className="subdiv-row">
          {SUBDIVISIONS.map(s => (
            <button
              key={s.id}
              className={cx('subdiv-btn', metronome.subdivision === s.sub && 'active')}
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
                const isMainBeat = subIdx === 0;
                const isAccent = beatIdx === 0 && isMainBeat;
                const isActive = metronome.currentBeat === beatIdx && metronome.currentSubBeat === subIdx;
                return (
                  <div
                    key={subIdx}
                    className={cx('beat-ind', isMainBeat ? 'main' : 'sub', isAccent && 'accent', isActive && 'active')}
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
            <button className="pixel-btn green" onClick={start}>▶ 시작</button>
          ) : (
            <button className="pixel-btn blue" onClick={metronome.stopScheduler}>■ 정지</button>
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
              {mic.micError && <div className="mic-error">{mic.micError}</div>}
            </div>
          ) : (
            <>
              {mic.feedback && (
                <div className={`tap-feedback ${mic.feedback.className}`}>
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
                  min={SENSITIVITY_MIN}
                  max={SENSITIVITY_MAX}
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
