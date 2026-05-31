import { useState, useRef, useCallback, useEffect } from 'react';
import { SENSITIVITY_DEFAULT, JUDGEMENTS, FEEDBACK_DURATION_MS } from '../constants';

const HIT_COOLDOWN_SEC = 0.10;

const MIC_ERROR_MESSAGES = {
  NotAllowedError: '마이크 접근이 거부되었습니다. 브라우저 설정에서 허용해주세요.',
  NotFoundError: '마이크 장치를 찾을 수 없습니다.',
  NotReadableError: '다른 앱이 마이크를 사용 중입니다.',
  OverconstrainedError: '요청한 마이크 설정을 지원하지 않습니다.',
  SecurityError: 'HTTPS 또는 localhost에서만 마이크를 사용할 수 있습니다.',
};

const judge = (ms) => JUDGEMENTS.find(j => ms < j.maxMs);

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
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
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
      setMicError(MIC_ERROR_MESSAGES[err.name] || `마이크 오류: ${err.name || err.message}`);
      setMicReady(false);
    }
  }, [getAudioCtx]);

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
    analyserRef.current = null;
    setMicReady(false);
    setVolume(0);
  }, []);

  const processHit = useCallback(() => {
    if (!playingRef.current) return;

    const now = getAudioCtx().currentTime;
    if (now - lastHitTimeRef.current < HIT_COOLDOWN_SEC) return;
    lastHitTimeRef.current = now;

    const minDiff = Math.min(
      ...lastTickTimesRef.current.map(t => Math.abs(now - t.time)),
      Math.abs(nextBeatTimeRef.current - now)
    );

    const { score, label, className } = judge(minDiff * 1000);
    setTaps(prev => [...prev, score]);
    setFeedback({ label, score, className });

    clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
  }, [getAudioCtx, lastTickTimesRef, nextBeatTimeRef]);

  const analyzeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.fftSize);
    // sensitivity 0~100 → threshold 90~10 (민감할수록 낮은 임계값)
    const getThreshold = () => 90 - sensitivityRef.current * 0.8;

    const loop = () => {
      analyser.getByteTimeDomainData(dataArray);

      let maxDeviation = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const d = Math.abs(dataArray[i] - 128);
        if (d > maxDeviation) maxDeviation = d;
      }

      // 볼륨 0~100 (세제곱근으로 작은 소리도 크게 표시)
      setVolume(Math.min(100, Math.round(Math.cbrt(maxDeviation / 128) * 100)));

      if (maxDeviation > getThreshold()) processHit();

      micAnimFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [processHit]);

  useEffect(() => {
    if (micReady && analyserRef.current) analyzeLoop();
    return () => {
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
    };
  }, [micReady, analyzeLoop]);

  useEffect(() => {
    return () => {
      stopMic();
      clearTimeout(feedbackTimeoutRef.current);
    };
  }, [stopMic]);

  const resetAccuracy = useCallback(() => {
    setTaps([]);
    setFeedback(null);
    clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = null;
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
