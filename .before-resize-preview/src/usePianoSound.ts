import { useEffect, useRef, useState } from 'react';

export function usePianoSound() {
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const [sound, setSound] = useState(true);
  const enabled = useRef(true);
  const [available, setAvailable] = useState(true);
  const voices = useRef(new Set<() => void>());

  // Create/resume only from a user gesture; no audio files or network requests.
  const unlock = () => {
    try {
      if (!audio.current) {
        const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audio.current = new Audio({ latencyHint: 'interactive' });
        master.current = audio.current.createGain();
        master.current.gain.value = enabled.current ? .55 : 0;
        const compressor = audio.current.createDynamicsCompressor();
        compressor.threshold.value = -18; compressor.knee.value = 12; compressor.ratio.value = 3;
        compressor.attack.value = .003; compressor.release.value = .18;
        master.current.connect(compressor).connect(audio.current.destination);
        // A quiet, filtered room reflection gives the generated piano a little air.
        const room = audio.current.createDelay(.3), damping = audio.current.createBiquadFilter(), wet = audio.current.createGain();
        room.delayTime.value = .085; damping.type = 'lowpass'; damping.frequency.value = 2400; wet.gain.value = .085;
        master.current.connect(room).connect(damping).connect(wet).connect(compressor);
      }
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => setAvailable(false));
    } catch { setAvailable(false); }
  };
  const play = (midi: number, duration = .45): (() => void) => {
    if (!enabled.current) return () => {};
    unlock();
    const context = audio.current;
    const output = master.current;
    if (!context || !output || context.state === 'closed') return () => {};
    const now = context.currentTime;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const length = Math.max(.08, Math.min(duration, 16));
    const oscillators: OscillatorNode[] = [];
    const envelopes: GainNode[] = [];
    let stopped = false;
    const stop = () => {
      if (stopped || context.state === 'closed') return;
      stopped = true;
      const time = context.currentTime;
      envelopes.forEach(envelope => {
        if (typeof envelope.gain.cancelAndHoldAtTime === 'function') envelope.gain.cancelAndHoldAtTime(time);
        else { envelope.gain.cancelScheduledValues(time); envelope.gain.setValueAtTime(Math.max(.0001, envelope.gain.value), time); }
        envelope.gain.exponentialRampToValueAtTime(.0001, time + .045);
      });
      oscillators.forEach(oscillator => { oscillator.stop(time + .05); });
      voices.current.delete(stop);
    };
    voices.current.add(stop);
    // A quick hammer attack with a warm fundamental and gently fading harmonics.
    [1, 2.001, 3.003, 4.007].forEach((harmonic, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * harmonic;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime([.24, .065, .025, .009][index], now + .006);
      envelope.gain.exponentialRampToValueAtTime([.035, .008, .002, .0004][index], now + Math.min(.6, length));
      envelope.gain.exponentialRampToValueAtTime(.0001, now + length + .22);
      oscillator.connect(envelope).connect(output);
      oscillators.push(oscillator); envelopes.push(envelope);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); if (index === 0) voices.current.delete(stop); };
      oscillator.start(now); oscillator.stop(now + length + .25);
    });
    return stop;
  };
  const toggle = () => {
    enabled.current = !enabled.current;
    setSound(enabled.current);
    unlock();
    if (audio.current && master.current) master.current.gain.setTargetAtTime(enabled.current ? .55 : 0, audio.current.currentTime, .015);
  };
  const stopAll = () => { voices.current.forEach(stop => stop()); voices.current.clear(); };
  useEffect(() => () => {
    if (audio.current && audio.current.state !== 'closed') void audio.current.close().catch(() => {});
    audio.current = null; master.current = null; voices.current.clear();
  }, []);
  return { sound, available, unlock, play, toggle, stopAll };
}
