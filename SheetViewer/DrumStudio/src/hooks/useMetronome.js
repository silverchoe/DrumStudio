import { useState, useRef, useCallback, useEffect } from 'react';
import { BEATS_PER_MEASURE } from '../constants';

export function useMetronome() {
  const [bpm, setBpm] = useState(100);
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

  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

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
      osc.frequency.value = 1600;
      gain.gain.setValueAtTime(0.25, time);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.08);
  }, [getAudioCtx]);

  const scheduleBeats = useCallback(() => {
    const ctx = getAudioCtx();
    const scheduleAhead = 0.1;
    const sub = subdivisionRef.current;
    const totalTicks = BEATS_PER_MEASURE * sub;
    const subInterval = 60.0 / bpm / sub;

    let lastMainBeat = -1;
    let lastSubBeat = -1;

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

      lastTickTimesRef.current.push({
        time: nextBeatTimeRef.current,
        beat: mainBeat,
        sub: subBeat,
      });
      if (lastTickTimesRef.current.length > 32) {
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

    schedulerRef.current = setInterval(() => scheduleBeats(), 25);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    setPlaying(true);
  }, [getAudioCtx, scheduleBeats]);

  const stopScheduler = useCallback(() => {
    clearInterval(schedulerRef.current);
    clearInterval(timerRef.current);
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
      schedulerRef.current = setInterval(() => scheduleBeats(), 25);
    }
  }, [bpm, playing, scheduleBeats]);

  return {
    bpm, setBpm,
    playing,
    currentBeat, currentSubBeat,
    subdivision, setSubdivision,
    elapsed,
    startScheduler, stopScheduler,
    audioCtxRef, lastTickTimesRef, nextBeatTimeRef,
  };
}
