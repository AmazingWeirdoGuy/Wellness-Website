import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { createStackGame, hardDropStack, lockStack, makeStackPiece, moveStack, rotateStack, stackCells, stackLanding, stackLevel, STACK_COLORS, type ArcadeGameProps, type StackCell, type StackGame } from './arcadeLogic';

type Phase = 'ready' | 'playing' | 'paused' | 'done';
type Action = 'left' | 'right' | 'down' | 'rotate' | 'reverse' | 'drop';
function Patch({ cell, ghost = false }: { cell: StackCell; ghost?: boolean }) {
  return <g transform={`translate(${cell.x * 20} ${cell.y * 20})`}>
    <rect x="1" y="1" width="18" height="18" rx="2" fill={ghost ? 'none' : STACK_COLORS[cell.kind]} stroke={ghost ? '#9c8971' : '#77634f'} strokeWidth=".9" strokeDasharray={ghost ? '3 2' : undefined}/>
    {!ghost && <><path d="M4 5H16M4 15H16" fill="none" stroke="#fff5dc" strokeWidth=".8" strokeDasharray="2 2" opacity=".7"/><path d="M4 3V17" stroke="#fff5dc" opacity=".2"/></>}
  </g>;
}

export function PatchworkStack({ best, onBest }: ArcadeGameProps) {
  const [game, setGame] = useState(createStackGame);
  const current = useRef(game);
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const root = useRef<HTMLDivElement>(null);
  const held = useRef(new Map<string, { action: Action; wait: number }>());
  const gravity = useRef(0);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState('Make a little room, row by row.');
  const patternId = useId().replaceAll(':', '');
  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); held.current.clear(); };
  const publish = (next: StackGame) => {
    const previous = current.current;
    if (next === previous) return;
    current.current = next; setGame(next);
    if (next.lines > previous.lines) setFeedback(`${next.lines - previous.lines} ${next.lines - previous.lines === 1 ? 'row cleared' : 'rows cleared'}. A little breathing room.`);
    if (next.over) { changePhase('done'); setFeedback('A little patchwork, made by you.'); }
  };
  const act = (action: Action) => {
    if (phaseRef.current !== 'playing') return;
    const old = current.current;
    if (action === 'drop') { publish(hardDropStack(old)); gravity.current = 0; }
    else if (action === 'rotate' || action === 'reverse') publish(rotateStack(old, action === 'rotate'));
    else {
      const next = moveStack(old, action === 'left' ? -1 : action === 'right' ? 1 : 0, action === 'down' ? 1 : 0);
      if (action === 'down') {
        publish(next === old ? lockStack(old) : { ...next, score: next.score + 1 });
        gravity.current = 0;
      } else publish(next);
    }
  };
  const actionRef = useRef(act);
  useEffect(() => { actionRef.current = act; });
  useEffect(() => { onBest(game.score); }, [game.score, onBest]);
  useEffect(() => {
    const pauseWhenAway = () => { if (phaseRef.current === 'playing') changePhase('paused'); };
    const hidden = () => { if (document.hidden) pauseWhenAway(); };
    window.addEventListener('blur', pauseWhenAway); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pauseWhenAway); document.removeEventListener('visibilitychange', hidden); held.current.clear(); };
  }, []);
  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      if (phaseRef.current !== 'playing') return;
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const horizontal = [...held.current.values()].filter((entry) => entry.action !== 'down').at(-1);
      const down = [...held.current.values()].find((entry) => entry.action === 'down');
      for (const entry of [horizontal, down]) {
        if (!entry) continue;
        entry.wait -= dt;
        if (entry.wait <= 0) { actionRef.current(entry.action); entry.wait += entry.action === 'down' ? .055 : .075; }
      }
      gravity.current += dt;
      const interval = Math.max(.1, .78 * .82 ** (stackLevel(current.current.lines) - 1));
      if (gravity.current >= interval) {
        gravity.current %= interval;
        const next = moveStack(current.current, 0, 1);
        publish(next === current.current ? lockStack(current.current) : next);
      }
      if (phaseRef.current === 'playing') frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [phase, round]);
  const start = () => {
    const next = createStackGame(); current.current = next; setGame(next); gravity.current = 0;
    setFeedback('A stitched outline shows where your piece will land.');
    setRound((value) => value + 1); changePhase('playing'); root.current?.focus({ preventScroll: true });
  };
  const pause = () => {
    if (phaseRef.current === 'playing') changePhase('paused');
    else if (phaseRef.current === 'paused') { changePhase('playing'); root.current?.focus({ preventScroll: true }); }
  };
  const actionFor = (code: string): Action | undefined => ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', KeyX: 'rotate', KeyZ: 'reverse', Space: 'drop' } as Record<string, Action>)[code];
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); if (!event.repeat) pause(); return; }
    const action = actionFor(event.code);
    if (!action || phaseRef.current !== 'playing') return;
    event.preventDefault();
    if (event.repeat) return;
    act(action);
    if (['left', 'right', 'down'].includes(action)) held.current.set(event.code, { action, wait: .17 });
  };
  const press = (event: PointerEvent<HTMLButtonElement>, action: Action) => {
    if (phaseRef.current !== 'playing') return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); root.current?.focus({ preventScroll: true });
    act(action); held.current.set(`pointer-${event.pointerId}`, { action, wait: .17 });
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => held.current.delete(`pointer-${event.pointerId}`);
  const control = (action: 'left' | 'right' | 'down', label: string, icon: ReactNode) => <button className="quiet-button" aria-label={label} disabled={phase !== 'playing'} onPointerDown={(event) => press(event, action)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onClick={(event) => { if (event.detail === 0) act(action); }}>{icon}</button>;
  const settled = game.board.flatMap((row, y) => row.flatMap((filled, x) => filled ? [{ x, y, kind: filled - 1 }] : []));
  const next = makeStackPiece(game.next);
  return <div ref={root} className="mini-activity-body mini-arcade arcade-focus" tabIndex={0} onKeyDown={keyDown} onKeyUp={(event) => held.current.delete(event.code)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) held.current.clear(); }} aria-label="Patchwork Stack. Arrow keys move, Up rotates, Space drops, P pauses.">
    <div className="patchwork-layout">
      <div className="patchwork-board-wrap">
        <svg className="patchwork-board" viewBox="0 0 200 400" role="img" aria-label="Falling patchwork pieces in a ten by twenty grid.">
          <defs><pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" stroke="#d3c3aa" fill="none" strokeWidth=".6"/></pattern></defs>
          <rect width="200" height="400" fill="#f3ead8"/><rect width="200" height="400" fill={`url(#${patternId})`}/>
          {settled.map((cell) => <Patch key={`${cell.x}-${cell.y}`} cell={cell}/>)}
          {!game.over && <>{stackCells(stackLanding(game)).filter((cell) => cell.y >= 0).map((cell) => <Patch key={`ghost-${cell.x}-${cell.y}`} cell={cell} ghost/>)}{stackCells(game.active).filter((cell) => cell.y >= 0).map((cell) => <Patch key={`falling-${cell.x}-${cell.y}`} cell={cell}/>)}</>}
        </svg>
        {phase !== 'playing' && <div className="arcade-overlay"><span className="eyebrow">Patchwork Stack</span><h4>{phase === 'ready' ? 'Piece by piece.' : phase === 'paused' ? 'A little pause.' : 'A full page.'}</h4><p>{phase === 'ready' ? 'Fit the pieces together. Complete a row to clear it.' : phase === 'paused' ? 'Your patchwork can wait.' : `${game.score} points, ${game.lines} ${game.lines === 1 ? 'row' : 'rows'}. Ready for a fresh page?`}</p><button className="primary-button" onClick={phase === 'paused' ? pause : start}><Play size={14}/>{phase === 'paused' ? 'Resume' : phase === 'ready' ? 'Start' : 'Play again'}</button></div>}
      </div>
      <aside className="patchwork-sidebar" aria-label="Patchwork game stats"><span className="eyebrow">Next piece</span><svg viewBox="0 0 90 90" aria-label="Next patchwork piece" role="img"><g transform={`translate(${(90 - next.shape.length * 20) / 2} ${(90 - next.shape.length * 20) / 2})`}>{stackCells({ ...next, x: 0 }).map((cell) => <Patch key={`${cell.x}-${cell.y}`} cell={cell}/>)}</g></svg><dl><dt>Score</dt><dd>{game.score}</dd><dt>Rows</dt><dd>{game.lines}</dd><dt>Level</dt><dd>{stackLevel(game.lines)}</dd><dt>Best</dt><dd>{Math.max(best, game.score)}</dd></dl></aside>
    </div>
    <div className="patchwork-controls" aria-label="Move the falling piece">{control('left', 'Move piece left', <ArrowLeft size={18}/>)}<button className="quiet-button" aria-label="Rotate piece clockwise" disabled={phase !== 'playing'} onClick={() => { act('rotate'); root.current?.focus({ preventScroll: true }); }}><RotateCw size={18}/></button>{control('right', 'Move piece right', <ArrowRight size={18}/>)}{control('down', 'Move piece down', <ArrowDown size={18}/>)}<button className="quiet-button" aria-label="Drop piece to the bottom" disabled={phase !== 'playing'} onClick={() => { act('drop'); root.current?.focus({ preventScroll: true }); }}><ChevronsDown size={18}/></button></div>
    <p className="arcade-feedback" role="status">{feedback}</p>
    <div className="mini-controls mini-controls-center"><button className="quiet-button" disabled={phase === 'ready' || phase === 'done'} onClick={pause}>{phase === 'paused' ? <Play size={14}/> : <Pause size={14}/>} {phase === 'paused' ? 'Resume' : 'Pause'}</button><button className="quiet-button" onClick={start}><RotateCcw size={14}/> Restart</button></div>
    <p className="mini-help">← → to move · ↑ or X to rotate · ↓ to lower · Space to drop · P to pause. The buttons work with touch, too.</p>
  </div>;
}
