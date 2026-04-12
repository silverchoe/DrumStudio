import React, { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';

const BEATS_PER_MEASURE = 4;

// 서브디비전: 1박당 몇 개의 클릭
const SUBDIVISIONS = [
  { id: '4beat',   label: '4비트',   sub: 1 },
  { id: '8beat',   label: '8비트',   sub: 2 },
  { id: '16beat',  label: '16비트',  sub: 4 },
  { id: 'triplet', label: '3연음',   sub: 3 },
];

const DEFAULT_SENSITIVITY = 92;

export default function Metronome({ onSaveRecord, onCheckTimeReward }) {
  const [bpm, setBpm] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentSubBeat, setCurrentSubBeat] = useState(-1);
  const [subdivision, setSubdivision] = useState(1); // 1=4비트, 2=8비트, 4=16비트, 3=3연음
  const [feedback, setFeedback] = useState(null);

  // Mic state
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState(null);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [volume, setVolume] = useState(0);
  const [hitFlash, setHitFlash] = useState(false);

  // Accuracy tracking
  const [taps, setTaps] = useState([]);
  const [totalTaps, setTotalTaps] = useState(0);

  // Timer
  const [elapsed, setElapsed] = useState(0);

  // Refs
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nextBeatTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const schedulerRef = useRef(null);
  const lastTickTimesRef = useRef([]);

  // Mic refs
  const micStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const micAnimFrameRef = useRef(null);
  const lastHitTimeRef = useRef(0);
  const playingRef = useRef(false);

  // Capture ref
  const captureRef = useRef(null);
  const captureHeaderRef = useRef(null);
  const captureTimerRef = useRef(null);

  // Keep playingRef synced
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // ── AudioContext ──
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // ── 마이크 시작 ──
  const startMic = useCallback(async () => {
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      micStreamRef.current = stream;

      const ctx = getAudioCtx();
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicReady(true);
    } catch (err) {
      console.error('Mic error:', err);
      setMicError('마이크 접근이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      setMicReady(false);
    }
  }, [getAudioCtx]);

  // ── 마이크 정지 ──
  const stopMic = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
    }
    analyserRef.current = null;
    setMicReady(false);
    setVolume(0);
  }, []);

  // ── 드럼 히트 감지 (감도 기반 임계값) ──
  const getThreshold = useCallback(() => {
    // sensitivity 0~100 → threshold 82~10 (민감할수록 낮은 임계값)
    return 90 - (sensitivity * 0.8);
  }, [sensitivity]);

  // ── 히트 처리 (정확도 계산) ──
  const processHit = useCallback(() => {
    if (!playingRef.current) return;

    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    // 쿨다운: 100ms 이내 중복 히트 방지
    if (now - lastHitTimeRef.current < 0.10) return;
    lastHitTimeRef.current = now;

    // 가장 가까운 비트 찾기
    let minDiff = Infinity;
    for (const tick of lastTickTimesRef.current) {
      const diff = Math.abs(now - tick.time);
      if (diff < minDiff) minDiff = diff;
    }
    const nextDiff = Math.abs(nextBeatTimeRef.current - now);
    if (nextDiff < minDiff) minDiff = nextDiff;

    const ms = minDiff * 1000;
    let score, label;

    if (ms < 40) {
      score = 100; label = 'PERFECT!';
    } else if (ms < 80) {
      score = 85; label = 'GREAT!';
    } else if (ms < 140) {
      score = 60; label = 'GOOD';
    } else {
      score = 20; label = 'MISS';
    }

    setTaps(prev => [...prev, score]);
    setTotalTaps(prev => prev + 1);
    setFeedback({ label, score });
    setHitFlash(true);

    setTimeout(() => setFeedback(null), 400);
    setTimeout(() => setHitFlash(false), 150);
  }, []);

  // ── 오디오 분석 루프 ──
  const analyzeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const threshold = getThreshold();

    const loop = () => {
      analyser.getByteTimeDomainData(dataArray);

      // 피크 볼륨 계산 (128이 중심, 편차로 볼륨 측정)
      let maxDeviation = 0;
      for (let i = 0; i < bufferLength; i++) {
        const deviation = Math.abs(dataArray[i] - 128);
        if (deviation > maxDeviation) maxDeviation = deviation;
      }

      // 볼륨 0~100 스케일 (세제곱근으로 작은 소리도 크게 표시)
      const normalizedVol = Math.min(100, Math.round(Math.cbrt(maxDeviation / 128) * 100));
      setVolume(normalizedVol);

      // 히트 감지: 임계값 초과
      if (maxDeviation > threshold) {
        processHit();
      }

      micAnimFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [getThreshold, processHit]);

  // analyser가 준비되면 분석 루프 시작
  useEffect(() => {
    if (micReady && analyserRef.current) {
      analyzeLoop();
    }
    return () => {
      if (micAnimFrameRef.current) {
        cancelAnimationFrame(micAnimFrameRef.current);
      }
    };
  }, [micReady, analyzeLoop]);

  // ── 메트로놈 클릭 소리 ──
  // type: 'accent' (강박), 'beat' (약박), 'sub' (서브디비전)
  const playClick = useCallback((type, time) => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'accent') {
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.8, time);
    } else if (type === 'beat') {
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.5, time);
    } else {
      // sub: 더 높고 작은 소리
      osc.frequency.value = 1600;
      gain.gain.setValueAtTime(0.25, time);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.08);
  }, [getAudioCtx]);

  // ── 비트 스케줄러 (서브디비전 포함) ──
  const subdivisionRef = useRef(subdivision);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  const scheduleBeats = useCallback(() => {
    const ctx = getAudioCtx();
    const scheduleAhead = 0.1;
    const sub = subdivisionRef.current;
    // 전체 틱 수: 4박 × subdivision
    const totalTicks = BEATS_PER_MEASURE * sub;
    // 각 서브틱 간격
    const subInterval = 60.0 / bpm / sub;

    while (nextBeatTimeRef.current < ctx.currentTime + scheduleAhead) {
      const tickIdx = beatIndexRef.current % totalTicks;
      const mainBeat = Math.floor(tickIdx / sub);
      const subBeat = tickIdx % sub;

      const isAccent = tickIdx === 0;
      const isMainBeat = subBeat === 0;

      if (isAccent) {
        playClick('accent', nextBeatTimeRef.current);
      } else if (isMainBeat) {
        playClick('beat', nextBeatTimeRef.current);
      } else {
        playClick('sub', nextBeatTimeRef.current);
      }

      // 정확도 측정용: 모든 틱 저장
      lastTickTimesRef.current.push({
        time: nextBeatTimeRef.current,
        beat: mainBeat,
        sub: subBeat,
      });
      if (lastTickTimesRef.current.length > 32) {
        lastTickTimesRef.current.shift();
      }

      setCurrentBeat(mainBeat);
      setCurrentSubBeat(subBeat);
      beatIndexRef.current++;
      nextBeatTimeRef.current += subInterval;
    }
  }, [bpm, playClick, getAudioCtx]);

  // ── 시작 ──
  const start = useCallback(async () => {
    if (!micReady) {
      await startMic();
    }

    // 상태 먼저 리셋
    setElapsed(0);
    setTaps([]);
    setTotalTaps(0);
    setFeedback(null);

    const ctx = getAudioCtx();
    await ctx.resume();
    beatIndexRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    lastTickTimesRef.current = [];

    schedulerRef.current = setInterval(() => scheduleBeats(), 25);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        onCheckTimeReward(next);
        return next;
      });
    }, 1000);

    setPlaying(true);
  }, [micReady, startMic, getAudioCtx, scheduleBeats, onCheckTimeReward]);

  // ── 정지 ──
  const stop = useCallback(() => {
    clearInterval(schedulerRef.current);
    clearInterval(timerRef.current);

    if (elapsed > 0 && totalTaps > 0) {
      const avgScore = taps.length > 0
        ? Math.round(taps.reduce((a, b) => a + b, 0) / taps.length)
        : 0;
      onSaveRecord({
        bpm,
        duration: elapsed,
        accuracy: avgScore,
        taps: totalTaps,
      });
    }

    setPlaying(false);
    setCurrentBeat(-1);
  }, [elapsed, taps, totalTaps, bpm, onSaveRecord]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(schedulerRef.current);
      clearInterval(timerRef.current);
      stopMic();
    };
  }, [stopMic]);

  // BPM 변경 시 스케줄러 갱신
  useEffect(() => {
    if (playing) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = setInterval(() => scheduleBeats(), 25);
    }
  }, [bpm, playing, scheduleBeats]);

  // ── 계산 값 ──
  const accuracy = taps.length > 0
    ? Math.round(taps.reduce((a, b) => a + b, 0) / taps.length)
    : 0;

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

  const feedbackClass = feedback
    ? feedback.score >= 100 ? 'perfect'
    : feedback.score >= 85 ? 'great'
    : feedback.score >= 60 ? 'good'
    : 'miss'
    : '';

  // 볼륨 바 색상
  const volColor = volume > 70 ? '#43A047' : volume > 40 ? '#1E88E5' : '#90CAF9';

  return (
    <div className="metronome-section">
      {/* BPM Control */}
      <div className="card">
        <div className="bpm-area">
          <button
            className="pixel-btn blue"
            onClick={() => setBpm(Math.max(40, bpm - 5))}
          >-5</button>
          <div>
            <div className="bpm-value">{bpm}</div>
            <div className="bpm-label">BPM</div>
          </div>
          <button
            className="pixel-btn red"
            onClick={() => setBpm(Math.min(200, bpm + 5))}
          >+5</button>
        </div>

        <div className="bpm-slider-wrap">
          <input
            type="range"
            className="bpm-slider"
            min="40"
            max="200"
            value={bpm}
            onChange={e => setBpm(+e.target.value)}
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
        {/* 서브디비전 선택 버튼 */}
        <div className="subdiv-row">
          {SUBDIVISIONS.map(s => (
            <button
              key={s.id}
              className={'subdiv-btn' + (subdivision === s.sub ? ' active' : '')}
              onClick={() => setSubdivision(s.sub)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 비트 인디케이터 (서브디비전 포함) */}
        <div className="beat-indicators">
          {Array.from({ length: BEATS_PER_MEASURE }).map((_, beatIdx) => (
            <div key={beatIdx} className="beat-group">
              {Array.from({ length: subdivision }).map((_, subIdx) => {
                const isActive =
                  currentBeat === beatIdx && currentSubBeat === subIdx;
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
          {formatTime(elapsed)}
        </div>

        <div className="controls-row">
          {!playing ? (
            <button className="pixel-btn green" onClick={start}>
              ▶ 시작
            </button>
          ) : (
            <button className="pixel-btn red" onClick={stop}>
              ■ 정지
            </button>
          )}
        </div>
      </div>

      {/* 마이크 & 소리 감지 영역 */}
      <div className="card">
        {/* 마이크 상태 */}
        <div className="mic-status-area">
          {!micReady ? (
            <div className="mic-off-box">
              <button className="mic-big-btn pixel-btn blue" onClick={startMic}>
                <span style={{ fontSize: 32 }}>🎙️</span>
                <span>마이크 켜기</span>
              </button>
              {micError && (
                <div style={{ fontSize: 7, color: '#E53935', marginTop: 8, lineHeight: 1.8 }}>
                  {micError}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 피드백 */}
              {feedback && (
                <div className={`tap-feedback ${feedbackClass}`}>
                  {feedback.label}
                </div>
              )}

              {/* 볼륨 미터 */}
              <div className="vol-meter-wrap">
                <div className="vol-meter-label">🔊 입력 레벨</div>
                <div className="vol-meter-bg">
                  <div
                    className="vol-meter-fill"
                    style={{
                      width: `${volume}%`,
                      background: volColor,
                    }}
                  />
                </div>
                <div className="vol-meter-val">{volume}%</div>
              </div>

              {/* 감도 조절 */}
              <div className="sensitivity-wrap">
                <div className="vol-meter-label">🎚️ 감도</div>
                <input
                  type="range"
                  className="bpm-slider"
                  min="10"
                  max="95"
                  value={sensitivity}
                  onChange={e => setSensitivity(+e.target.value)}
                  style={{ height: 8 }}
                />
                <div className="sensitivity-labels">
                  <span>둔감</span>
                  <span>민감</span>
                </div>
              </div>

              {/* 마이크 끄기 */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  className="pixel-btn gray"
                  onClick={stopMic}
                  style={{ fontSize: 7, padding: '6px 12px' }}
                >
                  🎙️ 마이크 끄기
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div ref={captureRef}>
          <div ref={captureHeaderRef} style={{ display: 'none', textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
            <div style={{ fontSize: 32, marginBottom: 8, color: '#43A047', textShadow: '1px 1px 0 #1B5E20' }}>★★★</div>
            <div style={{ fontSize: 15, marginBottom: 8, color: '#1E88E5', textShadow: '0.5px 0.5px 0 #0D47A1' }}>당신은 드럼의 신</div>
          </div>
          <div ref={captureTimerRef} style={{ display: 'none', textAlign: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: '#333', marginBottom: 8 }}>
            {formatTime(elapsed)}
          </div>
          <div className="stats-row" style={{ marginTop: 4 }}>
            <div className="stat-box">
              <div className="stat-val">{accuracy}%</div>
              <div className="stat-label">정확도</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{totalTaps}</div>
              <div className="stat-label">히트 수</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{bpm}</div>
              <div className="stat-label">BPM</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="pixel-btn green" onClick={handleCapture} style={{ fontSize: 10, padding: '8px 20px', boxShadow: 'none', textShadow: '1px 1px 0 #1B5E20' }}>
            📸 결과 캡처하기
          </button>
        </div>
      </div>
    </div>
  );
}
