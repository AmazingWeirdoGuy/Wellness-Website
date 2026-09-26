import { useEffect, useRef, useState } from 'react';

export function usePianoSound() {
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const [sound, setSound] = useState(true);
  const enabled = useRef(true);
  const [available, setAvailable] = useState(true);

  // Create/resume only from a user gesture; no audio files or network requests.
  const unlock = () => {
    try {
      if (!audio.current) {
        const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audio.current = new Audio();
        master.current = audio.current.createGain();
        master.current.gain.value = enabled.current ? .55 : 0;
        master.current.connect(audio.current.destination);
      }
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => setAvailable(false));
    } catch { setAvailable(false); }
  };
  const play = (midi: number) => {
    if (!enabled.current) return;
    unlock();
    const context = audio.current;
    const output = master.current;
    if (!context || !output || context.state === 'closed') return;
    const now = context.currentTime;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    // A quick hammer attack with a warm fundamental and gently fading harmonics.
    [1, 2, 3].forEach((harmonic, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * harmonic;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime([.24, .055, .018][index], now + .008);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + [1.05, .55, .3][index]);
      oscillator.connect(envelope).connect(output);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(now); oscillator.stop(now + 1.1);
    });
  };
  const toggle = () => {
    enabled.current = !enabled.current;
    setSound(enabled.current);
    unlock();
    if (audio.current && master.current) master.current.gain.setTargetAtTime(enabled.current ? .55 : 0, audio.current.currentTime, .015);
  };
  const suspend = () => { if (audio.current?.state === 'running') void audio.current.suspend().catch(() => {}); };
  useEffect(() => () => {
    if (audio.current && audio.current.state !== 'closed') void audio.current.close().catch(() => {});
    audio.current = null; master.current = null;
  }, []);
  return { sound, available, unlock, play, toggle, suspend };
}
