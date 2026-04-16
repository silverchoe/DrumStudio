import { useState, useRef, useCallback, useEffect } from 'react';

const DEFAULT_SENSITIVITY = 92;

export function useMic({ audioCtxRef, lastTickTimesRef, nextBeatTimeRef, playing }) {
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState(null);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [volume, setVolume] = useState(0);
  const [taps, setTaps] = useState([]);
  const [totalTaps, setTotalTaps] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const micStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const micAnimFrameRef = useRef(null);
  const lastHitTimeRef = useRef(0);
  const playingRef = useRef(false);
  const sensitivityRef = useRef(DEFAULT_SENSITIVITY);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

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

      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
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
  }, [audioCtxRef]);

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

  const getThreshold = useCallback(() => {
    // sensitivity 0~100 → threshold 82~10 (민감할수록 낮은 임계값)
    return 90 - (sensitivityRef.current * 0.8);
  }, []);

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

    setTimeout(() => setFeedback(null), 400);
  }, [audioCtxRef, lastTickTimesRef, nextBeatTimeRef]);

  const analyzeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

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

      // 히트 감지: 매 프레임마다 최신 threshold 읽기
      if (maxDeviation > getThreshold()) {
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

  // Cleanup
  useEffect(() => {
    return () => stopMic();
  }, [stopMic]);

  const resetAccuracy = useCallback(() => {
    setTaps([]);
    setTotalTaps(0);
    setFeedback(null);
  }, []);

  const accuracy = taps.length > 0
    ? Math.round(taps.reduce((a, b) => a + b, 0) / taps.length)
    : 0;

  return {
    micReady, micError,
    sensitivity, setSensitivity,
    volume,
    taps, totalTaps, feedback, accuracy,
    startMic, stopMic, resetAccuracy,
  };
}
