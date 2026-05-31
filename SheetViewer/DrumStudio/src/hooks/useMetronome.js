import { useState, useRef, useCallback, useEffect } from 'react';
import { BEATS_PER_MEASURE, BPM_DEFAULT, CLICK_GAIN } from '../constants';

const SCHEDULE_AHEAD_SEC = 0.1;
const SCHEDULER_INTERVAL_MS = 25;
const TICK_HISTORY_MAX = 32;
const SYNTH_FREQ = { accent: 1200, beat: 800, sub: 1600 };

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
  // public/sounds/{accent,beat,sub}.wav 있으면 사용, 없으면 sine 합성
  const soundBuffersRef = useRef({ accent: null, beat: null, sub: null });

  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const ctx = getAudioCtx();
    ['accent', 'beat', 'sub'].forEach(async (name) => {
      try {
        const res = await fetch(`${process.env.PUBLIC_URL}/sounds/${name}.wav`);
        if (!res.ok) return;
        soundBuffersRef.current[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* fallback to synth */ }
    });
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
      source = ctx.createBufferSource();
      source.buffer = buffer;
    } else {
      source = ctx.createOscillator();
      source.frequency.value = SYNTH_FREQ[type];
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

    let mainBeat = -1, subBeat = -1;

    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const tickIdx = beatIndexRef.current % totalTicks;
      mainBeat = Math.floor(tickIdx / sub);
      subBeat = tickIdx % sub;

      const type = tickIdx === 0 ? 'accent' : subBeat === 0 ? 'beat' : 'sub';
      playClick(type, nextBeatTimeRef.current);

      lastTickTimesRef.current.push({ time: nextBeatTimeRef.current, beat: mainBeat, sub: subBeat });
      if (lastTickTimesRef.current.length > TICK_HISTORY_MAX) lastTickTimesRef.current.shift();

      beatIndexRef.current++;
      nextBeatTimeRef.current += subInterval;
    }

    if (mainBeat >= 0) {
      setCurrentBeat(mainBeat);
      setCurrentSubBeat(subBeat);
    }
  }, [bpm, playClick, getAudioCtx]);

  const startScheduler = useCallback(async () => {
    const ctx = getAudioCtx();
    await ctx.resume();
    beatIndexRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    lastTickTimesRef.current = [];
    setElapsed(0);

    schedulerRef.current = setInterval(scheduleBeats, SCHEDULER_INTERVAL_MS);
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);

    setPlaying(true);
  }, [getAudioCtx, scheduleBeats]);

  const stopScheduler = useCallback(() => {
    clearInterval(schedulerRef.current);
    clearInterval(timerRef.current);
    schedulerRef.current = null;
    timerRef.current = null;

    // 이미 Web Audio에 예약된 oscillator 즉시 종료
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      for (const { osc, gain } of activeOscsRef.current) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now);
        } catch { /* 이미 끝났거나 아직 start 전이면 무시 */ }
      }
      activeOscsRef.current = [];
    }

    setPlaying(false);
    setCurrentBeat(-1);
  }, []);

  // unmount 시 인터벌 정리
  useEffect(() => () => {
    clearInterval(schedulerRef.current);
    clearInterval(timerRef.current);
  }, []);

  // BPM 변경 시 스케줄러 갱신
  useEffect(() => {
    if (playing) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = setInterval(scheduleBeats, SCHEDULER_INTERVAL_MS);
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
