import { useState, useRef, useCallback, useEffect } from 'react';
import { SENSITIVITY_DEFAULT, JUDGEMENTS, FEEDBACK_DURATION_MS } from '../constants';

const HIT_COOLDOWN_SEC = 0.10;

function judge(ms) {
  for (const j of JUDGEMENTS) {
    if (ms < j.maxMs) return j;
  }
  return JUDGEMENTS[JUDGEMENTS.length - 1];
}

export function useMic({ getAudioCtx, lastTickTimesRef, nextBeatTimeRef, playing }) {
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState(null);
  const [sensitivity, setSensitivity] = useState(SENSITIVITY_DEFAULT);
  const [volume, setVolume] = useState(0);
  const [taps, setTaps] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const micStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const micAnimFrameRef = useRef(null);
  const lastHitTimeRef = useRef(0);
  const playingRef = useRef(false);
  const sensitivityRef = useRef(SENSITIVITY_DEFAULT);
  const feedbackTimeoutRef = useRef(null);

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
    // sensitivity 0~100 → threshold 90~10 (민감할수록 낮은 임계값)
    return 90 - (sensitivityRef.current * 0.8);
  }, []);

  const processHit = useCallback(() => {
    if (!playingRef.current) return;

    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    if (now - lastHitTimeRef.current < HIT_COOLDOWN_SEC) return;
    lastHitTimeRef.current = now;

    // 가장 가까운 비트 찾기
    let minDiff = Infinity;
    for (const tick of lastTickTimesRef.current) {
      const diff = Math.abs(now - tick.time);
      if (diff < minDiff) minDiff = diff;
    }
    const nextDiff = Math.abs(nextBeatTimeRef.current - now);
    if (nextDiff < minDiff) minDiff = nextDiff;

    const { score, label, className } = judge(minDiff * 1000);

    setTaps(prev => [...prev, score]);
    setFeedback({ label, score, className });

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, FEEDBACK_DURATION_MS);
  }, [getAudioCtx, lastTickTimesRef, nextBeatTimeRef]);

  const analyzeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const loop = () => {
      analyser.getByteTimeDomainData(dataArray);

      let maxDeviation = 0;
      for (let i = 0; i < bufferLength; i++) {
        const deviation = Math.abs(dataArray[i] - 128);
        if (deviation > maxDeviation) maxDeviation = deviation;
      }

      // 볼륨 0~100 스케일 (세제곱근으로 작은 소리도 크게 표시)
      const normalizedVol = Math.min(100, Math.round(Math.cbrt(maxDeviation / 128) * 100));
      setVolume(normalizedVol);

      if (maxDeviation > getThreshold()) {
        processHit();
      }

      micAnimFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [getThreshold, processHit]);

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

  useEffect(() => {
    return () => {
      stopMic();
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, [stopMic]);

  const resetAccuracy = useCallback(() => {
    setTaps([]);
    setFeedback(null);
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  const totalTaps = taps.length;
  const accuracy = totalTaps > 0
    ? Math.round(taps.reduce((a, b) => a + b, 0) / totalTaps)
    : 0;

  return {
    micReady, micError,
    sensitivity, setSensitivity,
    volume,
    totalTaps, feedback, accuracy,
    startMic, stopMic, resetAccuracy,
  };
}
