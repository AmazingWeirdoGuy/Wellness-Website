import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { findPetalHit, PETAL_HIT_WINDOW, PETAL_HIT_Y, type ArcadeGameProps, type PetalNote } from './arcadeLogic';
import { usePianoSound } from './usePianoSound';

const KEYS = ['D', 'F', 'J', 'K'];
const COLORS = ['#8b9c7c', '#be7b68', '#9d7893', '#c7a160'];
const MELODY = [0, 1, 2, 1, 3, 2, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3];
type Phase = 'ready' | 'playing' | 'paused' | 'done';
type Run = { notes: PetalNote[]; score: number; combo: number; hits: number; mistakes: number; next: number; index: number; flashes: number[] };
const newNote = (index: number, y: number): PetalNote => {
  const lane = MELODY[index % MELODY.length];
  return { id: index, lane, y, midi: [60, 62, 64, 67][lane] + (Math.floor(index / 16) % 2 ? 12 : 0) };
};
const newRun = (): Run => ({ notes: [newNote(0, 210), newNote(1, 95), newNote(2, -20)], score: 0, combo: 0, hits: 0, mistakes: 0, next: .78, index: 3, flashes: [0, 0, 0, 0] });

function paintKeys(canvas: HTMLCanvasElement, run: Run) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(canvas.width / 400, 0, 0, canvas.height / 440, 0, 0);
  ctx.fillStyle = '#f5eddc'; ctx.fillRect(0, 0, 400, 440);
  for (let lane = 0; lane < 4; lane++) {
    ctx.fillStyle = lane % 2 ? '#efe5d2' : '#f5eddc'; ctx.fillRect(lane * 100, 0, 100, 440);
    if (run.flashes[lane] > 0) { ctx.globalAlpha = run.flashes[lane] * .6; ctx.fillStyle = COLORS[lane]; ctx.fillRect(lane * 100, 0, 100, 440); ctx.globalAlpha = 1; }
    ctx.strokeStyle = '#d4c5ae'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lane * 100, 0); ctx.lineTo(lane * 100, 440); ctx.stroke();
  }
  ctx.fillStyle = '#e4d8bc'; ctx.globalAlpha = .5; ctx.fillRect(0, PETAL_HIT_Y - PETAL_HIT_WINDOW, 400, PETAL_HIT_WINDOW * 2); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#92745b'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(0, PETAL_HIT_Y); ctx.lineTo(400, PETAL_HIT_Y); ctx.stroke(); ctx.setLineDash([]);
  for (const note of run.notes) {
    const x = note.lane * 100 + 12;
    ctx.fillStyle = 'rgba(84,62,47,.13)'; ctx.beginPath(); ctx.roundRect(x + 2, note.y - 30, 76, 64, 7); ctx.fill();
    ctx.fillStyle = COLORS[note.lane]; ctx.strokeStyle = '#6e5b4c'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.roundRect(x, note.y - 34, 76, 64, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,246,223,.55)'; ctx.setLineDash([3, 4]); ctx.strokeRect(x + 6, note.y - 28, 64, 52); ctx.setLineDash([]);
    ctx.save(); ctx.translate(x + 38, note.y - 2); ctx.fillStyle = '#f9efd9';
    for (let petal = 0; petal < 5; petal++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, -6, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#dec18b'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

export function PetalKeys({ best, onBest }: ArcadeGameProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const run = useRef<Run>(newRun());
  const [stats, setStats] = useState({ score: 0, combo: 0, mistakes: 0 });
  const [feedback, setFeedback] = useState('A little melody, one petal at a time.');
  const [round, setRound] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const sound = usePianoSound();
  const audioRef = useRef(sound);
  useEffect(() => { audioRef.current = sound; });
  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const publish = () => setStats({ score: run.current.score, combo: run.current.combo, mistakes: run.current.mistakes });
  const draw = useCallback(() => { if (canvas.current) paintKeys(canvas.current, run.current); }, []);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const resize = () => {
      const bounds = node.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      node.width = Math.max(1, Math.round(bounds.width * ratio)); node.height = Math.max(1, Math.round(bounds.height * ratio));
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); resize();
    return () => observer.disconnect();
  }, [draw]);
  useEffect(() => { onBest(stats.score); }, [stats.score, onBest]);
  useEffect(() => {
    const pauseWhenAway = () => {
      if (phaseRef.current !== 'playing') return;
      changePhase('paused'); audioRef.current.suspend();
    };
    const hidden = () => { if (document.hidden) pauseWhenAway(); };
    window.addEventListener('blur', pauseWhenAway); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pauseWhenAway); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    draw();
    if (phase !== 'playing') return;
    let previous = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      if (phaseRef.current !== 'playing') return;
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const current = run.current;
      const speed = Math.min(255, 145 + current.hits * 1.25);
      current.notes.forEach((note) => { note.y += speed * dt; });
      current.flashes = current.flashes.map((flash) => Math.max(0, flash - dt));
      current.next -= dt;
      if (current.next <= 0) {
        current.notes.push(newNote(current.index++, -34));
        current.next += Math.max(.45, .78 - current.hits * .003);
      }
      const missed = current.notes.filter((note) => note.y > PETAL_HIT_Y + PETAL_HIT_WINDOW);
      if (missed.length) {
        current.notes = current.notes.filter((note) => note.y <= PETAL_HIT_Y + PETAL_HIT_WINDOW);
        current.mistakes = Math.min(3, current.mistakes + missed.length); current.combo = 0;
        setFeedback('A petal slipped past. Find the next one.'); publish();
        if (current.mistakes >= 3) { changePhase('done'); setFeedback('A little music for this moment.'); draw(); return; }
      }
      draw(); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [phase, round, draw]);
  const start = () => {
    sound.unlock(); run.current = newRun(); publish(); setFeedback('Press when a petal reaches the stitched line.');
    setRound((value) => value + 1); changePhase('playing'); root.current?.focus({ preventScroll: true });
  };
  const pause = () => {
    if (phaseRef.current === 'playing') { changePhase('paused'); sound.suspend(); }
    else if (phaseRef.current === 'paused') { sound.unlock(); changePhase('playing'); root.current?.focus({ preventScroll: true }); }
  };
  const hit = (lane: number) => {
    if (phaseRef.current !== 'playing') return;
    const current = run.current;
    const note = findPetalHit(current.notes, lane);
    current.flashes[lane] = .25;
    if (note) {
      current.notes = current.notes.filter((item) => item.id !== note.id);
      const perfect = Math.abs(note.y - PETAL_HIT_Y) < 18;
      current.score += perfect ? 20 : 10; current.hits++; current.combo++;
      sound.play(note.midi); setFeedback(perfect ? 'Right on the note.' : 'Keep the melody going.');
    } else {
      current.combo = 0; current.mistakes = Math.min(3, current.mistakes + 1);
      setFeedback('Wait for a petal at the stitched line.');
      if (current.mistakes >= 3) changePhase('done');
    }
    publish(); draw();
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const lane = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'].indexOf(event.code);
    if (lane >= 0) { event.preventDefault(); if (!event.repeat) hit(lane); }
    else if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); if (!event.repeat) pause(); }
  };
  return <div ref={root} className="mini-activity-body mini-arcade arcade-focus" tabIndex={0} onKeyDown={keyDown} aria-label="Petal Keys. Use D, F, J, K, or the four touch keys. P pauses.">
    <div className="mini-game-stats"><span>Score <strong>{stats.score}</strong></span><span>Best <strong>{Math.max(best, stats.score)}</strong></span><span>Chances <strong>{3 - stats.mistakes}</strong></span></div>
    <div className="petal-board-wrap">
      <canvas ref={canvas} className="petal-board" width="400" height="440" aria-label="Four lanes of falling flower tiles. Play each lane when its tile reaches the stitched line." />
      {phase !== 'playing' && <div className="arcade-overlay"><span className="eyebrow">Petal Keys</span><h4>{phase === 'ready' ? 'Find your rhythm.' : phase === 'paused' ? 'A little pause.' : 'A melody of your own.'}</h4><p>{phase === 'ready' ? 'Match the falling petals with D, F, J, K. Three slips end a round.' : phase === 'paused' ? 'Your notes will wait right here.' : `${stats.score} points. There is always another melody.`}</p><button className="primary-button" onClick={phase === 'paused' ? pause : start}><Play size={14}/>{phase === 'paused' ? 'Resume' : phase === 'ready' ? 'Start playing' : 'Play again'}</button></div>}
      <div className="petal-touch-keys">{KEYS.map((key, lane) => <button key={key} aria-label={`Play ${key} lane`} disabled={phase !== 'playing'} onPointerDown={(event) => { event.preventDefault(); root.current?.focus({ preventScroll: true }); hit(lane); }} onClick={(event) => { if (event.detail === 0) hit(lane); }}><kbd>{key}</kbd><span>{['Do', 'Re', 'Mi', 'Sol'][lane]}</span></button>)}</div>
    </div>
    <p className="arcade-feedback" role="status">{feedback}{stats.combo >= 3 ? ` · ${stats.combo} in a row` : ''}</p>
    <div className="mini-controls mini-controls-center"><button className="quiet-button" disabled={phase === 'ready' || phase === 'done'} onClick={pause}>{phase === 'paused' ? <Play size={14}/> : <Pause size={14}/>} {phase === 'paused' ? 'Resume' : 'Pause'}</button><button className="quiet-button" onClick={start}><RotateCcw size={14}/> Restart</button><button className="quiet-button" onClick={sound.toggle} aria-pressed={!sound.sound} aria-label={sound.sound ? 'Mute piano sound' : 'Enable piano sound'}>{sound.sound ? <Volume2 size={14}/> : <VolumeX size={14}/>}Sound {sound.sound ? 'on' : 'off'}</button></div>
    <p className="mini-help">D F J K, or tap the four keys. Play at the stitched line. P to pause.{!sound.available && ' Audio is unavailable in this browser; you can still play.'}</p>
  </div>;
}
