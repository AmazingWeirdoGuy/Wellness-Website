import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Crown, Flower2, Music2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { ArcadeGameProps } from './arcadeLogic';
import { advancePetalRun, createPetalRun, pausePetalRun, pressPetalLane, releasePetalLane, PETAL_LEAD_IN, PETAL_LINE, type PetalEvent, type PetalRun } from './petalKeysLogic';
import { PETAL_SONGS } from './petalSongs';
import { usePianoSound } from './usePianoSound';

const KEYS = ['D', 'F', 'J', 'K'];
const COLORS = ['#8b9c7c', '#be7b68', '#9d7893', '#c7a160'];
const TILE_COLORS = ['#53664e', '#985c52', '#775369', '#927242'];
type Phase = 'ready' | 'playing' | 'paused' | 'done';
const snapshot = (run: PetalRun) => ({ score: run.score, combo: run.combo, mistakes: run.mistakes, hits: run.hits,
  progress: Math.min(100, Math.round(Math.max(0, run.time - PETAL_LEAD_IN) / Math.max(1, run.end - PETAL_LEAD_IN) * 100)), pressed: [...run.pressed],
  holds: KEYS.map((_, lane) => {
    const note = run.notes.find(item => item.lane === lane && item.state === 'holding');
    return note ? Math.max(0, Math.min(1, (run.time - note.at) / note.holdFor)) : null;
  }) });

function paintKeys(canvas: HTMLCanvasElement, run: PetalRun, speed: number, compact = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(canvas.width / 400, 0, 0, canvas.height / 400, 0, 0);
  ctx.fillStyle = '#f5eddc'; ctx.fillRect(0, 0, 400, 400);
  for (let lane = 0; lane < 4; lane++) {
    const paper = ctx.createLinearGradient(lane * 100, 0, lane * 100 + 100, 0);
    paper.addColorStop(0, '#e7dcc8'); paper.addColorStop(.12, lane % 2 ? '#f2e8d5' : '#faf2e2'); paper.addColorStop(1, '#f0e5d0');
    ctx.fillStyle = paper; ctx.fillRect(lane * 100, 0, 100, 400);
    if (run.pressed[lane] || run.flashes[lane] > 0) {
      ctx.globalAlpha = run.pressed[lane] ? .22 : run.flashes[lane] * .65;
      ctx.fillStyle = COLORS[lane]; ctx.fillRect(lane * 100, 0, 100, 400); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#d4c5ae'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lane * 100, 0); ctx.lineTo(lane * 100, 400); ctx.stroke();
  }
  ctx.fillStyle = '#e4d8bc'; ctx.globalAlpha = .5; ctx.fillRect(0, PETAL_LINE - 21, 400, 42); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#92745b'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(0, PETAL_LINE); ctx.lineTo(400, PETAL_LINE); ctx.stroke(); ctx.setLineDash([]);
  // Later notes paint first, keeping a held flower legible at the timing line.
  for (let index = run.notes.length - 1; index >= 0; index--) {
    const note = run.notes[index];
    if (note.state === 'hit' || note.state === 'missed') continue;
    const movingHead = PETAL_LINE + (run.time - note.at) * speed;
    const holding = note.state === 'holding';
    const head = holding ? PETAL_LINE : movingHead;
    const tail = note.holdFor ? movingHead - note.holdFor * speed : head;
    if (head < -26 || tail > 460) continue;
    const x = note.lane * 100 + 13;
    if (note.holdFor) {
      const top = Math.max(-30, tail), height = Math.max(8, head - top);
      ctx.fillStyle = COLORS[note.lane]; ctx.globalAlpha = holding ? .92 : .64;
      ctx.beginPath(); ctx.roundRect(x + 13, top, 48, height + 8, 10); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff3dc'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(x + 22, top + 7); ctx.lineTo(x + 22, head); ctx.moveTo(x + 52, top + 7); ctx.lineTo(x + 52, head); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#6e5b4c'; ctx.beginPath(); ctx.moveTo(x + 20, top + 3); ctx.lineTo(x + 54, top + 3); ctx.stroke();
    }
    const halfHeight = compact ? 17 : 22;
    ctx.fillStyle = 'rgba(84,62,47,.12)'; ctx.beginPath(); ctx.roundRect(x + 2, head - halfHeight + 3, 74, halfHeight * 2, 8); ctx.fill();
    const tile = ctx.createLinearGradient(x, head - halfHeight, x + 74, head + halfHeight);
    tile.addColorStop(0, COLORS[note.lane]); tile.addColorStop(1, TILE_COLORS[note.lane]);
    ctx.fillStyle = tile; ctx.strokeStyle = holding ? '#fff5de' : TILE_COLORS[note.lane]; ctx.lineWidth = holding ? 3 : 1.3;
    ctx.beginPath(); ctx.roundRect(x, head - halfHeight, 74, halfHeight * 2, 8); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(x + 37, head); ctx.fillStyle = '#f9efd9';
    for (let petal = 0; petal < 5; petal++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, -6, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#dec18b'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (note.holdFor) {
      // A readable ring fills around the flower; no miniature text on the tile.
      const progress = holding ? Math.max(0, Math.min(1, (run.time - note.at) / note.holdFor)) : 0;
      ctx.strokeStyle = '#fff5de55'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x + 37, head, 17, 0, Math.PI * 2); ctx.stroke();
      if (holding) {
        ctx.strokeStyle = '#fff5de'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x + 37, head, 17, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke(); ctx.lineCap = 'butt';
      }
    }
  }
  for (let lane = 0; lane < 4; lane++) {
    const life = run.flashes[lane] / .3;
    if (life <= 0 || run.pressed[lane]) continue;
    ctx.globalAlpha = Math.min(1, life); ctx.strokeStyle = COLORS[lane]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(lane * 100 + 50, PETAL_LINE, 24 + (1 - life) * 24, 8 + (1 - life) * 13, 0, 0, Math.PI * 2); ctx.stroke();
    for (let petal = 0; petal < 6; petal++) {
      const angle = petal * Math.PI / 3, distance = 15 + (1 - life) * 35;
      ctx.fillStyle = petal % 2 ? '#ad8b54' : COLORS[lane]; ctx.beginPath();
      ctx.ellipse(lane * 100 + 50 + Math.cos(angle) * distance, PETAL_LINE + Math.sin(angle) * distance * .65, 2, 4, angle, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (run.time < PETAL_LEAD_IN && !run.finished) {
    ctx.fillStyle = '#6b3544'; ctx.font = '24px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(PETAL_LEAD_IN - run.time)), 200, 215);
  }
}

export function PetalKeys({ best, onBest }: ArcadeGameProps) {
  const [songId, setSongId] = useState(PETAL_SONGS[0].id);
  const song = PETAL_SONGS.find(item => item.id === songId)!;
  const isBoss = song.difficulty === 'Final boss';
  const [practice, setPractice] = useState(false);
  const chart = useMemo(() => practice ? song.chart.map(note => ({ ...note,
    at: PETAL_LEAD_IN + (note.at - PETAL_LEAD_IN) / .75, duration: note.duration / .75, holdFor: note.holdFor / .75,
  })) : song.chart, [song, practice]);
  const songRef = useRef(song); songRef.current = song;
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const lastTick = useRef(0);
  const run = useRef<PetalRun>(null!);
  if (!run.current) run.current = createPetalRun(chart, practice);
  const [stats, setStats] = useState(() => snapshot(run.current));
  const [feedback, setFeedback] = useState('Choose a melody. Start gently, or try a little challenge.');
  const [round, setRound] = useState(0);
  const [judgement, setJudgement] = useState({ label: 'A little music, just for you', tone: 'quiet', id: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const keySources = useRef(Array.from({ length: 4 }, () => new Set<string>()));
  const heldVoices = useRef(new Map<number, () => void>());
  const boardPointers = useRef(new Map<number, number>());
  const sound = usePianoSound();
  const audioRef = useRef(sound); audioRef.current = sound;
  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const publish = useCallback(() => setStats(snapshot(run.current)), []);
  const draw = useCallback(() => { if (canvas.current) paintKeys(canvas.current, run.current,
    (songRef.current.difficulty === 'Final boss' ? 350 : 180 + Math.min(songRef.current.rank, 13) * 8) * (run.current.practice ? .8 : 1),
    songRef.current.difficulty === 'Final boss'); }, []);
  const clearInputs = useCallback(() => {
    keySources.current.forEach(sources => sources.clear());
    boardPointers.current.clear();
    heldVoices.current.clear(); audioRef.current.stopAll();
  }, []);
  const finish = useCallback(() => {
    clearInputs(); run.current.pressed.fill(false); changePhase('done'); publish();
    setFeedback(run.current.completed ? 'Melody complete. Thank you for making a little music.' : 'Three petals slipped. Try Practice for a gentler pace.');
  }, [changePhase, clearInputs, publish]);
  const handleEvents = useCallback((events: PetalEvent[]) => {
    for (const event of events) {
      const note = event.note;
      if (note && (event.kind === 'tap' || event.kind === 'hold' || event.kind === 'rehold')) {
        const duration = event.kind !== 'tap' ? Math.max(.1, note.at + note.holdFor - run.current.time) : note.duration;
        const stop = audioRef.current.play(note.midi, duration);
        if (event.kind !== 'tap') heldVoices.current.set(note.lane, stop);
      }
      if (note && (event.kind === 'held' || event.kind === 'miss')) {
        heldVoices.current.get(note.lane)?.(); heldVoices.current.delete(note.lane);
      }
      if (event.kind === 'hold') setFeedback(`Hold ${KEYS[note!.lane]} until the ribbon reaches the line.`);
      else if (event.kind === 'rehold') setFeedback('Welcome back. Keep the melody going.');
      else if (event.kind === 'held') setFeedback('Beautifully held. Release and find the next petal.');
      else if (event.kind === 'miss') setFeedback(event.reason === 'early' ? 'Keep holding until the ribbon ends.' : 'Find the next petal at the stitched line.');
      else setFeedback(note?.perfect ? 'Right on the note.' : 'Keep the melody going.');
      setJudgement(previous => ({ id: previous.id + 1,
        label: event.kind === 'miss' ? event.reason === 'early' ? 'A little longer' : 'Find the next note' : event.kind === 'hold' || event.kind === 'rehold' ? `Hold ${KEYS[note!.lane]}` : event.kind === 'held' ? 'Beautifully held' : note?.perfect ? 'Perfect' : 'Lovely',
        tone: event.kind === 'miss' ? 'miss' : 'hit' }));
    }
    publish();
    if (run.current.finished) finish();
  }, [finish, publish]);
  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    pausePetalRun(run.current); clearInputs(); changePhase('paused'); publish(); draw();
  }, [changePhase, clearInputs, draw, publish]);
  const stepTo = useCallback((now: number) => {
    if (phaseRef.current !== 'playing') return;
    const dt = Math.max(0, (now - lastTick.current) / 1000);
    lastTick.current = Math.max(lastTick.current, now);
    // A stalled tab should wait for the player, rather than skip a screen of notes.
    if (dt > .35) { pauseGame(); return; }
    const events = advancePetalRun(run.current, dt);
    if (events.length) handleEvents(events);
    else if (run.current.finished) finish();
  }, [finish, handleEvents, pauseGame]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const resize = () => {
      const bounds = node.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      node.width = Math.max(1, Math.round(bounds.width * ratio)); node.height = Math.max(1, Math.round(bounds.height * ratio)); draw();
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    return () => observer.disconnect();
  }, [draw]);
  useEffect(() => { if (!practice) onBest(stats.score); }, [stats.score, onBest, practice]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) pauseGame(); };
    window.addEventListener('blur', pauseGame); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pauseGame); document.removeEventListener('visibilitychange', hidden); };
  }, [pauseGame]);
  useEffect(() => {
    draw();
    if (phase !== 'playing') return;
    let frame = 0, lastPublished = 0;
    const animate = (now: number) => {
      if (phaseRef.current !== 'playing') return;
      stepTo(now);
      if (now - lastPublished >= 50) { publish(); lastPublished = now; }
      draw();
      if (phaseRef.current === 'playing') frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [phase, round, draw, stepTo, publish]);

  const start = () => {
    clearInputs(); sound.unlock(); run.current = createPetalRun(chart, practice); publish();
    setJudgement(previous => ({ label: 'Ready when you are', tone: 'quiet', id: previous.id + 1 }));
    setFeedback('Tap the flowers. Hold the ribbons until their ends reach the line.');
    lastTick.current = performance.now();
    setRound(value => value + 1); changePhase('playing'); root.current?.focus({ preventScroll: true });
    canvas.current?.parentElement?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
  const pause = () => {
    if (phaseRef.current === 'playing') pauseGame();
    else if (phaseRef.current === 'paused') {
      sound.unlock(); lastTick.current = performance.now(); changePhase('playing'); root.current?.focus({ preventScroll: true });
      if (run.current.awaitingRehold) setFeedback(`Hold ${run.current.notes.filter(note => note.state === 'holding').map(note => KEYS[note.lane]).join(' + ')} to continue. Your music will wait.`);
    }
  };
  const chooseSong = (id: string) => {
    const next = PETAL_SONGS.find(item => item.id === id);
    if (!next) return;
    clearInputs(); run.current = createPetalRun(next.chart); songRef.current = next; setSongId(id);
    changePhase('ready'); publish(); setFeedback('A fresh melody, whenever you are ready.'); draw();
  };
  const chooseMode = (next: boolean) => {
    clearInputs(); run.current = createPetalRun(song.chart, next); publish(); setPractice(next); changePhase('ready'); draw();
  };
  const press = (lane: number, source: string) => {
    if (phaseRef.current !== 'playing') return;
    // Judge the input's time, not the time of the previous animation frame.
    stepTo(performance.now());
    if (phaseRef.current !== 'playing') return;
    const sources = keySources.current[lane];
    if (sources.has(source)) return;
    sources.add(source);
    if (sources.size === 1) {
      const event = pressPetalLane(run.current, lane);
      if (event) handleEvents([event]);
    }
    publish(); draw();
  };
  const release = (lane: number, source: string) => {
    stepTo(performance.now());
    const sources = keySources.current[lane];
    if (!sources.delete(source) || sources.size || phaseRef.current !== 'playing') return;
    const event = releasePetalLane(run.current, lane);
    if (event) handleEvents([event]);
    heldVoices.current.get(lane)?.(); heldVoices.current.delete(lane);
    publish(); draw();
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || /^(SELECT|INPUT|TEXTAREA)$/.test((event.target as HTMLElement).tagName)) return;
    const lane = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'].indexOf(event.code);
    if (lane >= 0) { event.preventDefault(); if (!event.repeat) press(lane, 'keyboard'); }
    else if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); if (!event.repeat) pause(); }
  };
  const keyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const lane = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'].indexOf(event.code);
    if (lane >= 0) { if (keySources.current[lane].has('keyboard')) event.preventDefault(); release(lane, 'keyboard'); }
  };
  const releaseBoardPointer = (pointerId: number) => {
    const lane = boardPointers.current.get(pointerId);
    if (lane === undefined) return;
    release(lane, `board-${pointerId}`); boardPointers.current.delete(pointerId);
  };
  const rehold = run.current.awaitingRehold;
  return <div ref={root} className="mini-activity-body mini-arcade petal-game arcade-focus" data-boss={isBoss} tabIndex={0} onKeyDown={keyDown} onKeyUp={keyUp}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pauseGame(); }}
    aria-label="Petal Keys. Use D, F, J, K, or the four touch keys. Hold ribbon notes. P pauses.">
    <div className="petal-song-picker">
      <label htmlFor="petal-song"><span><Music2 size={15}/> Petal Keys</span><span>{song.difficulty} · {song.rank} / {PETAL_SONGS.length}</span></label>
      <select id="petal-song" value={songId} disabled={phase === 'playing'} onChange={event => chooseSong(event.target.value)}>
        {PETAL_SONGS.map(item => <option key={item.id} value={item.id}>{item.rank}. {item.title} · {item.difficulty}</option>)}
      </select>
      <div className="petal-song-meta"><span>{song.composer}</span><span>{Math.ceil(song.seconds / (practice ? .75 : 1))}s · {isBoss ? `${Math.round(song.bpm * (practice ? .75 : 1))} BPM` : `${song.holds} holds`}</span></div>
    </div>
    <div className="petal-scorebar"><div><span>Score</span><strong>{stats.score.toLocaleString()}</strong></div><div className="petal-combo">{stats.combo >= 3 ? <><strong>{stats.combo}×</strong><span>in a row</span></> : <><span>{practice ? 'Practice' : 'Session best'}</span><strong>{practice ? `${stats.hits} notes` : Math.max(best, stats.score).toLocaleString()}</strong></>}</div><div className="petal-chances" role="img" aria-label={practice ? 'Practice: unlimited chances' : `${Math.max(0, 3 - stats.mistakes)} chances remaining`}>{[0, 1, 2].map(index => <Flower2 key={index} size={20} className={practice || index < 3 - stats.mistakes ? 'is-full' : ''}/>)}</div></div>
    <div className="petal-board-wrap">
      <progress className="petal-song-progress" max="100" value={stats.progress} aria-label="Song progress"/>
      <canvas ref={canvas} className="petal-board" width="400" height="400" data-playing={phase === 'playing'} aria-label="Falling flowers are tap notes. Stitched ribbons are hold notes. Play at the stitched line."
        onPointerDown={event => { if (phaseRef.current !== 'playing') return; event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); const lane = Math.max(0, Math.min(3, Math.floor((event.clientX - bounds.left) / bounds.width * 4))); event.currentTarget.setPointerCapture(event.pointerId); boardPointers.current.set(event.pointerId, lane); root.current?.focus({ preventScroll: true }); press(lane, `board-${event.pointerId}`); }}
        onPointerUp={event => releaseBoardPointer(event.pointerId)} onPointerCancel={event => releaseBoardPointer(event.pointerId)} onLostPointerCapture={event => releaseBoardPointer(event.pointerId)}/>
      {phase !== 'playing' && <div className="arcade-overlay">
        <div className="petal-overlay-flower">{isBoss ? <Crown size={32}/> : <Flower2 size={32}/>}</div>
        <span className="eyebrow">{practice ? 'A gentler pace' : song.difficulty}</span>
        <h4>{phase === 'ready' ? isBoss ? 'The final flight.' : 'Find your rhythm.' : phase === 'paused' ? 'A little pause.' : run.current.completed ? isBoss ? 'Final boss cleared.' : 'Melody complete.' : 'Try another verse.'}</h4>
        <p>{phase === 'ready' ? isBoss ? `${song.chart.length} notes. One buzzing flight. Try Practice to learn the pattern.` : 'Tap flowers. Hold ribbons until the ring fills.' : phase === 'paused' ? 'Your notes will wait. You can also choose another song above.' : `${stats.score} points · ${stats.hits} of ${song.chart.length} notes. A little music for this moment.`}</p>
        {phase !== 'paused' && <div className="petal-mode" aria-label="Playing mode"><button aria-pressed={!practice} onClick={() => chooseMode(false)}>Play</button><button aria-pressed={practice} onClick={() => chooseMode(true)}>Practice</button></div>}
        {phase !== 'paused' && <small className="petal-mode-hint">{practice ? '75% pace · Unlimited chances' : 'Three chances · One melody'}</small>}
        <button className="primary-button" onClick={phase === 'paused' ? pause : start}><Play size={14}/>{phase === 'paused' ? 'Resume' : phase === 'ready' ? 'Start playing' : 'Play again'}</button>
      </div>}
      {phase === 'playing' && rehold && <div className="petal-rehold">Re-hold the glowing key to continue</div>}
      <div className="petal-touch-keys">{KEYS.map((key, lane) => <button key={key} aria-label={`Play ${key} lane`} aria-pressed={stats.pressed[lane]} disabled={phase !== 'playing'}
        data-holding={stats.holds[lane] !== null} style={{ '--hold-progress': stats.holds[lane] ?? 0 } as CSSProperties}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); root.current?.focus({ preventScroll: true }); press(lane, `pointer-${event.pointerId}`); }}
        onPointerUp={event => { release(lane, `pointer-${event.pointerId}`); }}
        onPointerCancel={event => { release(lane, `pointer-${event.pointerId}`); }}
        onLostPointerCapture={event => { release(lane, `pointer-${event.pointerId}`); }}
        onKeyDown={event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); if (!event.repeat) press(lane, 'button'); } }}
        onKeyUp={event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(lane, 'button'); } }}
        onClick={event => { if (event.detail === 0) { if (keySources.current[lane].has('assistive')) release(lane, 'assistive'); else { press(lane, 'assistive'); if (!run.current.notes.some(note => note.lane === lane && note.state === 'holding')) release(lane, 'assistive'); } } }}>
        <kbd>{key}</kbd><span>{stats.holds[lane] !== null ? 'Hold…' : stats.pressed[lane] ? 'Release' : 'Tap'}</span>
      </button>)}</div>
    </div>
    <div className="petal-judgement" data-tone={judgement.tone}><span key={judgement.id}>{phase === 'playing' ? judgement.label : phase === 'done' && run.current.completed ? 'A whole melody, made by you' : 'A little music, just for you'}</span></div>
    <p className="sr-only" role="status">{feedback}</p>
    <div className="mini-controls mini-controls-center"><button className="quiet-button" disabled={phase === 'ready' || phase === 'done'} onClick={pause}>{phase === 'paused' ? <Play size={14}/> : <Pause size={14}/>} {phase === 'paused' ? 'Resume' : 'Pause'}</button><button className="quiet-button" onClick={start}><RotateCcw size={14}/> Restart</button><button className="quiet-button" onClick={sound.toggle} aria-pressed={!sound.sound} aria-label={sound.sound ? 'Mute piano sound' : 'Enable piano sound'}>{sound.sound ? <Volume2 size={14}/> : <VolumeX size={14}/>}Sound {sound.sound ? 'on' : 'off'}</button></div>
    <p className="mini-help">D F J K or tap a lane · Hold ribbons · P to pause{!sound.available && ' · Audio unavailable in this browser'}</p>
    <details className="petal-music-credits"><summary>About these arrangements</summary><p>Short melody arrangements for four keys. Difficulty ranks these game charts, not the original piano pieces.</p><p>{song.credit}. <a href={song.sourceUrl} target="_blank" rel="noreferrer">Score source</a> · <a href={song.licenseUrl} target="_blank" rel="noreferrer">{song.license}</a>. Adapted into a single melody with game tempo, tap notes, and holds.</p></details>
  </div>;
}
