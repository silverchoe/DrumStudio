import { useState, useRef, useCallback, useEffect } from 'react';
import { BEATS_PER_MEASURE, BPM_DEFAULT, CLICK_GAIN } from '../constants';

const SCHEDULE_AHEAD_SEC = 0.1;
const SCHEDULER_INTERVAL_MS = 25;
const TICK_HISTORY_MAX = 32;

export function useMetronome() {
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentSubBeat, setCurrentSubBeat] = useState(-1);
  const [subdivision, setSubdivision] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nextBeatTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const schedulerRef = useRef(null);
  const lastTickTimesRef = useRef([]);
  const subdivisionRef = useRef(subdivision);
  const activeOscsRef = useRef([]);
  // public/sounds/{accent,beat,sub}.wav 가 있으면 그걸 사용, 없으면 sine 합성
  const soundBuffersRef = useRef({ accent: null, beat: null, sub: null });

  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // mount 시 사운드 파일 로드 시도 (없으면 silent skip)
  useEffect(() => {
    const ctx = getAudioCtx();
    const load = async (name) => {
      try {
        const res = await fetch(`${process.env.PUBLIC_URL}/sounds/${name}.wav`);
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        soundBuffersRef.current[name] = buf;
      } catch (e) { /* fallback to synth */ }
    };
    load('accent');
    load('beat');
    load('sub');
  }, [getAudioCtx]);

  // type: 'accent' (강박), 'beat' (약박), 'sub' (서브디비전)
  const playClick = useCallback((type, time) => {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(CLICK_GAIN[type], time);

    const buffer = soundBuffersRef.current[type];
    let source;

    if (buffer) {
      // 샘플 파일 재생
      source = ctx.createBufferSource();
      source.buffer = buffer;
    } else {
      // Fallback: sine 합성
      source = ctx.createOscillator();
      if (type === 'accent') source.frequency.value = 1200;
      else if (type === 'beat') source.frequency.value = 800;
      else source.frequency.value = 1600;
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    }
    source.connect(gain);

    // stop() 시 즉시 종료할 수 있게 추적
    const node = { osc: source, gain };
    activeOscsRef.current.push(node);
    source.onended = () => {
      const i = activeOscsRef.current.indexOf(node);
      if (i >= 0) activeOscsRef.current.splice(i, 1);
    };

    source.start(time);
    if (!buffer) source.stop(time + 0.08);
  }, [getAudioCtx]);

  const scheduleBeats = useCallback(() => {
    const ctx = getAudioCtx();
    const sub = subdivisionRef.current;
    const totalTicks = BEATS_PER_MEASURE * sub;
    const subInterval = 60.0 / bpm / sub;

    let lastMainBeat = -1;
    let lastSubBeat = -1;

    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
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

      lastTickTimesRef.current.push({
        time: nextBeatTimeRef.current,
        beat: mainBeat,
        sub: subBeat,
      });
      if (lastTickTimesRef.current.length > TICK_HISTORY_MAX) {
        lastTickTimesRef.current.shift();
      }

      lastMainBeat = mainBeat;
      lastSubBeat = subBeat;
      beatIndexRef.current++;
      nextBeatTimeRef.current += subInterval;
    }

    if (lastMainBeat >= 0) {
      setCurrentBeat(lastMainBeat);
      setCurrentSubBeat(lastSubBeat);
    }
  }, [bpm, playClick, getAudioCtx]);

  const startScheduler = useCallback(async () => {
    const ctx = getAudioCtx();
    await ctx.resume();
    beatIndexRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    lastTickTimesRef.current = [];
    setElapsed(0);

    schedulerRef.current = setInterval(() => scheduleBeats(), SCHEDULER_INTERVAL_MS);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    setPlaying(true);
  }, [getAudioCtx, scheduleBeats]);

  const stopScheduler = useCallback(() => {
    clearInterval(schedulerRef.current);
    clearInterval(timerRef.current);
    schedulerRef.current = null;
    timerRef.current = null;

    // 이미 Web Audio 스케줄러에 예약된 oscillator 즉시 종료
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      for (const { osc, gain } of activeOscsRef.current) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now);
        } catch (e) { /* 이미 끝났거나 아직 start 전이면 무시 */ }
      }
      activeOscsRef.current = [];
    }

    setPlaying(false);
    setCurrentBeat(-1);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(schedulerRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  // BPM 변경 시 스케줄러 갱신
  useEffect(() => {
    if (playing) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = setInterval(() => scheduleBeats(), SCHEDULER_INTERVAL_MS);
    }
  }, [bpm, playing, scheduleBeats]);

  return {
    bpm, setBpm,
    playing,
    currentBeat, currentSubBeat,
    subdivision, setSubdivision,
    elapsed,
    startScheduler, stopScheduler,
    getAudioCtx, lastTickTimesRef, nextBeatTimeRef,
  };
}
