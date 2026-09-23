import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { ArrowLeft, Check, Pause, Play, RotateCcw, ShieldCheck, Square, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import './mindfulness.css';

type ActivityId = 'breath' | 'doodles' | 'folding' | 'garden' | 'ripples' | 'rocks' | 'water';
type Point = { x: number; y: number };
type Stroke = { id: number; points: Point[]; color: string; size: number; at: number };
type FoldShape = 'boat' | 'crane' | 'heart';
type GardenKind = 'poppy' | 'daisy' | 'leaf' | 'sprig' | 'scrap';
type GardenItem = { id: number; kind: GardenKind; x: number; y: number; rotation: number; scale: number };
type Ripple = { id: number; x: number; y: number; at: number };

export type MindfulnessState = {
  current: ActivityId | null;
  breath: { running: boolean; elapsed: number; pace: 'slow' | 'gentle' | 'steady'; mode: 'gentle' | 'box' };
  doodles: { strokes: Stroke[]; guide: 'none' | 'spiral' | 'winding' | 'shape'; color: string; size: number };
  folding: { shape: FoldShape; step: number };
  garden: { items: GardenItem[]; history: GardenItem[][]; selected: number | null; tool: GardenKind; done: boolean };
  ripples: { waves: Ripple[]; clock: number; watching: boolean; paused: boolean };
  rocks: { progress: number; running: boolean; settling: boolean; sound: boolean };
  water: { strokes: Stroke[]; clock: number; size: number; drying: 'normal' | 'slow' | 'paused' };
};

export const createMindfulnessState = (): MindfulnessState => ({
  current: null,
  breath: { running: false, elapsed: 0, pace: 'gentle', mode: 'gentle' },
  doodles: { strokes: [], guide: 'none', color: '#493b34', size: 3 },
  folding: { shape: 'boat', step: 0 },
  garden: { items: [], history: [], selected: null, tool: 'poppy', done: false },
  ripples: { waves: [], clock: 0, watching: false, paused: false },
  rocks: { progress: 0, running: false, settling: false, sound: false },
  water: { strokes: [], clock: 0, size: 9, drying: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'paused' : 'normal' },
});

type Props = {
  state: MindfulnessState;
  setState: Dispatch<SetStateAction<MindfulnessState>>;
  onSupport: () => void;
};

const activities: Array<{ id: ActivityId; name: string; hint: string }> = [
  { id: 'breath', name: 'Take a Breath', hint: 'A flower, at your pace' },
  { id: 'doodles', name: 'Margin Doodles', hint: 'Wander across the page' },
  { id: 'folding', name: 'Paper Folding', hint: 'One fold at a time' },
  { id: 'garden', name: 'Pressed-Flower Garden', hint: 'Arrange what you find' },
  { id: 'ripples', name: 'Ink Ripples', hint: 'Watch small circles widen' },
  { id: 'rocks', name: 'Skipping Rocks', hint: 'A quiet throw across water' },
  { id: 'water', name: 'Water Calligraphy', hint: 'Marks that gently dry' },
];

const newId = () => crypto.getRandomValues(new Uint32Array(1))[0];
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>, width = 600, height = 400): Point => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width * width, 0, width),
    y: clamp((event.clientY - bounds.top) / bounds.height * height, 0, height),
  };
};
const pathFromPoints = (points: Point[]) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(preference.matches);
    preference.addEventListener('change', onChange);
    return () => preference.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function MiniIllustration({ id }: { id: ActivityId }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="" focusable="false">
      <defs>
        <filter id={`paper-wash-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="4" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" />
        </filter>
      </defs>
      <rect width="100" height="100" rx="20" fill="#e8ddc8" />
      <path d="M0 70 Q28 57 55 73 T100 67 V100 H0Z" fill="#d8c9ae" opacity=".55" />
      <g filter={`url(#paper-wash-${id})`} stroke="#66574b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {id === 'breath' && <><path d="M49 51 Q47 70 51 85" fill="none" /><path d="M50 73 Q34 63 28 70 Q37 80 50 76M50 70 Q63 58 72 65 Q66 76 51 75" fill="#9fad88" opacity=".8" /><g fill="#d8a089" opacity=".82"><ellipse cx="50" cy="33" rx="11" ry="20" /><ellipse cx="50" cy="55" rx="11" ry="20" /><ellipse cx="39" cy="44" rx="20" ry="11" /><ellipse cx="61" cy="44" rx="20" ry="11" /></g><circle cx="50" cy="44" r="11" fill="#e9c98d" /></>}
        {id === 'doodles' && <><path d="M31 61 C20 42 44 19 65 35 C82 48 64 76 43 66 C29 59 38 41 51 43 C64 44 61 57 51 58 C44 58 44 51 49 50" fill="none" stroke="#7d645c" strokeWidth="2" /><path d="M69 70 L83 42 L88 45 L74 73Z" fill="#c9aa79" /><path d="M69 70 L74 73 L67 77Z" fill="#55463d" /><path d="M83 42 L87 35 L91 38 L88 45" fill="#b96355" /></>}
        {id === 'folding' && <><path d="M13 60 L51 33 L87 60Z" fill="#e9cfac" /><path d="M19 61 L81 61 L70 75 L31 75Z" fill="#f6ead7" /><path d="M51 33 L51 61 M31 75 L51 61 L70 75" fill="none" strokeDasharray="3 2" /><path d="M15 81 Q51 76 85 81" fill="none" stroke="#9bb0ae" opacity=".7" /></>}
        {id === 'garden' && <><path d="M18 25 L82 20 L85 76 L20 79Z" fill="#f2e8d5" /><path d="M45 69 Q42 49 49 36" fill="none" stroke="#73856c" /><path d="M46 56 Q34 44 30 54 Q39 62 46 60M49 51 Q60 41 65 48 Q58 56 49 54" fill="#a3ae8b" /><g fill="#bf786f"><ellipse cx="49" cy="32" rx="7" ry="14" /><ellipse cx="49" cy="32" rx="14" ry="7" /></g><circle cx="49" cy="32" r="5" fill="#dfc38e" /><path d="M23 19 L44 18 L46 29 L24 30Z" fill="#f6e9d1" opacity=".55" /></>}
        {id === 'ripples' && <><path d="M50 19 C61 37 64 44 50 55 C36 45 39 37 50 19Z" fill="#6d8592" /><ellipse cx="50" cy="69" rx="31" ry="10" fill="none" stroke="#718b94" opacity=".7" /><ellipse cx="50" cy="69" rx="20" ry="6" fill="none" stroke="#718b94" opacity=".75" /><ellipse cx="50" cy="69" rx="9" ry="3" fill="none" stroke="#718b94" /></>}
        {id === 'rocks' && <><path d="M0 62 Q35 55 100 64 V100 H0Z" fill="#a9c1bd" opacity=".8" /><path d="M18 73 Q50 68 85 76 M24 84 Q54 81 79 86" fill="none" stroke="#f2eee1" opacity=".8" /><path d="M38 43 Q54 34 68 43 L70 50 Q54 57 36 49Z" fill="#8e8171" /><path d="M43 44 Q57 40 64 44" fill="none" stroke="#b9aa92" /></>}
        {id === 'water' && <><path d="M25 70 Q40 50 53 62 T79 42" fill="none" stroke="#657d82" strokeWidth="8" opacity=".55" /><path d="M65 27 L84 47 L91 39 L71 21Z" fill="#af845e" /><path d="M65 27 L58 21 Q59 36 70 35Z" fill="#5b5550" /><path d="M28 77 Q46 68 55 73" fill="none" stroke="#91a4a2" opacity=".5" /></>}
      </g>
    </svg>
  );
}

function Launcher({ onOpen }: { onOpen: (activity: ActivityId) => void }) {
  return (
    <div className="mini-launcher mini-paper-in">
      <div className="mini-intro"><h3>Mindfulness Minigames.</h3><p>A little space to pause.</p></div>
      <div className="mini-app-grid">
        {activities.map((activity) => <button className="mini-app" key={activity.id} onClick={() => onOpen(activity.id)} data-testid={`mini-open-${activity.id}`}>
          <span className="mini-app-icon"><MiniIllustration id={activity.id} /></span>
          <strong>{activity.name}</strong><small>{activity.hint}</small>
        </button>)}
      </div>
    </div>
  );
}

function BreathActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const breath = state.breath;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!breath.running) return;
    const timer = window.setInterval(() => setState((current) => ({ ...current, breath: { ...current.breath, elapsed: current.breath.elapsed + .05 } })), 50);
    return () => window.clearInterval(timer);
  }, [breath.running, setState]);
  const inhale = breath.pace === 'slow' ? 5 : breath.pace === 'steady' ? 3 : 4;
  const exhale = breath.pace === 'slow' ? 7 : breath.pace === 'steady' ? 4 : 6;
  const hold = breath.pace === 'slow' ? 5 : breath.pace === 'steady' ? 3 : 4;
  const phases = breath.mode === 'box' ? [
    { label: 'Inhale', duration: hold }, { label: 'Hold', duration: hold },
    { label: 'Exhale', duration: hold }, { label: 'Hold', duration: hold },
  ] : [{ label: 'Inhale', duration: inhale }, { label: 'Exhale', duration: exhale }];
  const cycle = phases.reduce((sum, phase) => sum + phase.duration, 0);
  let within = breath.elapsed % cycle;
  let phaseIndex = 0;
  while (phaseIndex < phases.length - 1 && within >= phases[phaseIndex].duration) within -= phases[phaseIndex++].duration;
  const currentPhase = phases[phaseIndex];
  const openness = reducedMotion || (!breath.running && breath.elapsed === 0) ? .45 : phaseIndex === 0 ? within / currentPhase.duration : breath.mode === 'box' && phaseIndex === 1 ? 1 : breath.mode === 'box' && phaseIndex === 3 ? 0 : 1 - within / currentPhase.duration;
  const setBreath = (patch: Partial<MindfulnessState['breath']>) => setState((current) => ({ ...current, breath: { ...current.breath, ...patch } }));
  return <div className="mini-activity-body mini-breath">
    <div className="mini-art-panel mini-flower-panel">
      <svg viewBox="0 0 600 350" role="img" aria-label={`Flower ${currentPhase.label.toLowerCase()} phase`}>
        <defs><radialGradient id="breath-petal"><stop stopColor="#e9c7a6" /><stop offset="1" stopColor="#bf827c" /></radialGradient></defs>
        <path d="M300 200 Q289 265 302 322" fill="none" stroke="#78866b" strokeWidth="5" strokeLinecap="round" />
        <path d="M297 274 Q260 246 243 265 Q268 293 298 284 M303 280 Q337 246 355 263 Q333 293 303 288" fill="#a7b28d" stroke="#7b896e" strokeWidth="2" />
        <g transform="translate(300 170)">
          {Array.from({ length: 8 }, (_, index) => <ellipse key={index} cx="0" cy={-35 - openness * 23} rx={12 + openness * 11} ry={30 + openness * 16} transform={`rotate(${index * 45})`} fill="url(#breath-petal)" stroke="#ad7770" strokeWidth="1.5" opacity=".82" />)}
          <circle r="28" fill="#e8c98e" stroke="#9b8060" strokeWidth="2" />
          <circle r="17" fill="#f4dda9" opacity=".65" />
        </g>
      </svg>
      <div className="mini-breath-cue" aria-live="polite"><strong>{breath.running ? currentPhase.label : breath.elapsed > 0 ? 'Paused' : 'Ready when you are'}</strong><span>{breath.mode === 'box' ? 'Optional box breathing' : 'No breath holds'}</span></div>
      <div className="mini-breath-phases" aria-label="Breathing phases">{phases.map((phase, index) => <span key={`${phase.label}-${index}`} className={breath.running && index === phaseIndex ? 'active' : ''}>{phase.label}</span>)}</div>
    </div>
    <div className="mini-controls"><label>Pace <select value={breath.pace} onChange={(event) => setBreath({ pace: event.target.value as MindfulnessState['breath']['pace'] })}><option value="slow">Slow</option><option value="gentle">Gentle</option><option value="steady">Steady</option></select></label><label>Pattern <select value={breath.mode} onChange={(event) => setBreath({ mode: event.target.value as MindfulnessState['breath']['mode'], elapsed: 0 })}><option value="gentle">Inhale · exhale</option><option value="box">Box breathing with holds</option></select></label></div>
    <div className="mini-controls mini-controls-center"><button className="primary-button" onClick={() => setBreath({ running: !breath.running })}>{breath.running ? <Pause size={15} /> : <Play size={15} />}{breath.running ? 'Pause' : 'Start'}</button><button className="quiet-button" onClick={() => setBreath({ running: false, elapsed: 0 })}><Square size={13} /> Stop</button></div>
    <p className="mini-help">Follow the flower if it feels comfortable. Change the pace or leave at any time.</p>
  </div>;
}

function DoodlesActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const doodles = state.doodles;
  const drawing = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 300, y: 200 });
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const setDoodles = (patch: Partial<MindfulnessState['doodles']>) => setState((current) => ({ ...current, doodles: { ...current.doodles, ...patch } }));
  const addKeyboardStroke = (points: Point[]) => setState((current) => ({ ...current, doodles: { ...current.doodles, strokes: [...current.doodles.strokes, { id: newId(), points, color: current.doodles.color, size: current.doodles.size, at: 0 }] } }));
  const finish = () => {
    if (!drawing.current) return;
    const stroke = drawing.current;
    setState((current) => ({ ...current, doodles: { ...current.doodles, strokes: [...current.doodles.strokes, stroke] } }));
    drawing.current = null;
    setLive(null);
  };
  const guide = doodles.guide === 'spiral' ? <path d="M300 200 C265 170 280 125 335 140 C405 160 410 240 340 267 C240 300 174 224 206 143 C236 65 359 72 422 143" /> : doodles.guide === 'winding' ? <path d="M35 300 C130 340 130 100 225 141 S322 340 410 241 S478 70 565 113" /> : doodles.guide === 'shape' ? <><circle cx="208" cy="205" r="85" /><path d="M335 291 L422 112 L522 291Z" /></> : null;
  return <div className="mini-activity-body">
    <div className="mini-controls"><label>Optional guide <select value={doodles.guide} onChange={(event) => setDoodles({ guide: event.target.value as MindfulnessState['doodles']['guide'] })}><option value="none">Blank page</option><option value="spiral">Spiral</option><option value="winding">Winding line</option><option value="shape">Simple shapes</option></select></label><label>Brush size <select value={doodles.size} onChange={(event) => setDoodles({ size: Number(event.target.value) })}><option value="2">Fine</option><option value="3">Medium</option><option value="6">Broad</option></select></label><div className="mini-swatches" aria-label="Ink colours">{['#493b34', '#865f68', '#6a8072', '#617e8a'].map((color) => <button key={color} className={doodles.color === color ? 'selected' : ''} style={{ backgroundColor: color }} aria-label={`Ink colour ${color}`} aria-pressed={doodles.color === color} onClick={() => setDoodles({ color })} />)}</div></div>
    <svg className="mini-drawing-board" viewBox="0 0 600 400" preserveAspectRatio="none" tabIndex={0} role="img" aria-label="Doodle on this paper. Use touch or mouse, or arrow keys to move, Space to mark, and Shift with arrows to draw." onFocus={() => setKeyboardFocus(true)} onBlur={() => setKeyboardFocus(false)} onKeyDown={(event) => { const step = 16; const offsets: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }; const offset = offsets[event.key]; if (offset) { event.preventDefault(); const next = { x: clamp(cursor.x + offset.x, 0, 600), y: clamp(cursor.y + offset.y, 0, 400) }; if (event.shiftKey) addKeyboardStroke([cursor, next]); setCursor(next); } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addKeyboardStroke([cursor]); } }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const stroke = { id: newId(), points: [pointFromEvent(event)], color: doodles.color, size: doodles.size, at: 0 }; drawing.current = stroke; setLive(stroke); }} onPointerMove={(event) => { if (!drawing.current) return; const stroke = { ...drawing.current, points: [...drawing.current.points, pointFromEvent(event)] }; drawing.current = stroke; setLive(stroke); }} onPointerUp={finish} onPointerCancel={finish}>
      <rect width="600" height="400" fill="#f6efdf" />
      <path d="M34 80H565M34 135H565M34 190H565M34 245H565M34 300H565M34 355H565" stroke="#b9a897" opacity=".27" />
      {guide && <g className="mini-guide" fill="none" stroke="#9a9c89" strokeWidth="2" strokeDasharray="5 7">{guide}</g>}
      {[...doodles.strokes, ...(live ? [live] : [])].map((stroke) => stroke.points.length === 1 ? <circle key={stroke.id} cx={stroke.points[0].x} cy={stroke.points[0].y} r={stroke.size / 2} fill={stroke.color} /> : <path key={stroke.id} d={pathFromPoints(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.size} strokeLinecap="round" strokeLinejoin="round" />)}
      {keyboardFocus && <circle className="mini-keyboard-cursor" cx={cursor.x} cy={cursor.y} r="9" fill="none" />}
    </svg>
    <div className="mini-controls"><button className="quiet-button" disabled={!doodles.strokes.length} onClick={() => setDoodles({ strokes: doodles.strokes.slice(0, -1) })}><Undo2 size={14} /> Undo</button><button className="quiet-button" disabled={!doodles.strokes.length} onClick={() => setDoodles({ strokes: [] })}><Trash2 size={14} /> Clear</button></div>
    <p className="mini-help">Follow a line, cross it, or leave it behind. The page is yours to wander on.</p>
  </div>;
}

const foldInstructions: Record<FoldShape, string[]> = {
  boat: ['Begin with a square of paper.', 'Fold the top toward the bottom.', 'Bring the corners into the centre.', 'Open the lower edges.', 'Let your little boat rest.'],
  crane: ['Begin with a square of paper.', 'Fold diagonally into a triangle.', 'Bring both edges toward the centre.', 'Lift the neck and wings.', 'Let your crane rest.'],
  heart: ['Begin with a square of paper.', 'Fold diagonally into a triangle.', 'Bring the sides toward the tip.', 'Turn the top corners down.', 'Let your heart rest.'],
};
const foldPaths: Record<FoldShape, string[]> = {
  boat: ['M190 80H410V300H190Z', 'M190 125H410V275H190Z', 'M190 245L300 100L410 245Z', 'M175 250L300 160L425 250L385 300H215Z', 'M130 225H470L414 290H188Z'],
  crane: ['M190 80H410V300H190Z', 'M300 70L445 290H155Z', 'M300 90L390 288H210Z', 'M300 98L336 280L450 172L360 306H240L150 172L264 280Z', 'M300 110L335 245L462 172L372 278L336 290H264L228 278L138 172L265 245Z'],
  heart: ['M190 80H410V300H190Z', 'M300 85L448 290H152Z', 'M300 100L435 225L300 302L165 225Z', 'M300 292L155 165L225 105L300 171L375 105L445 165Z', 'M300 294L154 163Q145 115 200 105Q257 99 300 151Q343 99 400 105Q455 115 446 163Z'],
};
const foldNextCrease: Record<FoldShape, string[]> = {
  boat: ['M190 190H410', 'M190 125L300 208L410 125', 'M300 100V245', 'M175 250H425'],
  crane: ['M190 80L410 300', 'M210 288L300 90L390 288', 'M300 98V282', 'M155 172L265 245M445 172L335 245'],
  heart: ['M190 80L410 300', 'M165 225L300 100L435 225', 'M165 225L300 292L435 225', 'M155 165L225 105M445 165L375 105'],
};

function FoldingActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const folding = state.folding;
  const [replay, setReplay] = useState(0);
  const setFolding = (patch: Partial<MindfulnessState['folding']>) => setState((current) => ({ ...current, folding: { ...current.folding, ...patch } }));
  return <div className="mini-activity-body mini-folding">
    <div className="mini-controls"><label>Fold a <select value={folding.shape} onChange={(event) => { setFolding({ shape: event.target.value as FoldShape, step: 0 }); setReplay((value) => value + 1); }}><option value="boat">Boat</option><option value="crane">Crane</option><option value="heart">Heart</option></select></label><span className="mini-step-count">Step {folding.step + 1} of 5</span></div>
    <div className="mini-art-panel mini-fold-art"><svg key={`${folding.shape}-${folding.step}-${replay}`} className="fold-step-art" viewBox="0 0 600 380" role="img" aria-label={`${folding.shape} folding step ${folding.step + 1}`}>
      <defs><linearGradient id="fold-paper" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff9e9" /><stop offset="1" stopColor="#d7c5a8" /></linearGradient></defs>
      <path d={foldPaths[folding.shape][folding.step]} fill="url(#fold-paper)" stroke="#8d7866" strokeWidth="3" strokeLinejoin="round" />
      {folding.step > 0 && <path d={folding.shape === 'boat' ? 'M188 246L300 160L412 246M300 160V285' : folding.shape === 'crane' ? 'M300 100V285M224 246L375 246' : 'M300 154V294M200 165L300 225L400 165'} fill="none" stroke="#a9957b" strokeWidth="2" strokeDasharray="7 7" opacity=".72" />}
      {folding.step < 4 && <path className="fold-next-crease" d={foldNextCrease[folding.shape][folding.step]} fill="none" stroke="#b76b56" strokeWidth="2.5" strokeDasharray="7 6" />}
      {folding.step === 4 && folding.shape === 'boat' && <path d="M188 225L300 124L414 225M300 124V276" fill="none" stroke="#8d7866" strokeWidth="2" strokeDasharray="5 5" />}
      {folding.step === 4 && folding.shape === 'crane' && <circle cx="302" cy="151" r="3" fill="#8d7866" />}
    </svg></div>
    <p className="mini-fold-instruction" aria-live="polite">{foldInstructions[folding.shape][folding.step]}</p>
    <div className="mini-controls mini-controls-center"><button className="quiet-button" disabled={folding.step === 0} onClick={() => setFolding({ step: folding.step - 1 })}><Undo2 size={14} /> Undo fold</button><button className="quiet-button" onClick={() => setReplay((value) => value + 1)}><RotateCcw size={14} /> Repeat step</button><button className="primary-button" disabled={folding.step === 4} onClick={() => setFolding({ step: folding.step + 1 })}>{folding.step === 3 ? 'Finish fold' : 'Next fold'}</button><button className="quiet-button" onClick={() => setFolding({ step: 0 })}>Restart</button></div>
    <p className="mini-help">Take every fold at your own pace. You can undo or repeat any step.</p>
  </div>;
}

function GardenMotif({ kind }: { kind: GardenKind }) {
  if (kind === 'scrap') return <><path d="M-29-21L24-25L29 22L-23 27Z" fill="#d4bd9f" stroke="#9c846d" strokeWidth="1.5" /><path d="M-17-4H15M-13 5H19M-18 14H10" stroke="#a28d77" opacity=".5" /></>;
  if (kind === 'leaf') return <><path d="M-25 23Q-23-20 18-29Q29 5-25 23Z" fill="#a3ad8c" stroke="#72826e" strokeWidth="1.5" /><path d="M-25 23Q-2-5 18-29M-12 9L-14-7M-1-3L10 2" fill="none" stroke="#71816d" /></>;
  if (kind === 'sprig') return <><path d="M-2 29Q4-7-2-29" fill="none" stroke="#687d6b" strokeWidth="2" />{[-18, -7, 5, 17].map((y, index) => <g key={y}><ellipse cx={index % 2 ? -11 : 11} cy={y} rx="12" ry="5" transform={`rotate(${index % 2 ? 26 : -26} ${index % 2 ? -11 : 11} ${y})`} fill="#a6b797" stroke="#768b75" /><circle cx={index % 2 ? 7 : -7} cy={y - 6} r="3" fill="#bd8880" /></g>)}</>;
  return <><path d="M0 28Q-3 5 0-6" fill="none" stroke="#698169" strokeWidth="2" /><path d="M0 18Q-13 7-20 12Q-9 22 0 21M0 13Q13 3 20 9Q10 19 0 17" fill="#aab897" stroke="#768b74" /><g fill={kind === 'poppy' ? '#bd7a72' : '#e6cfaa'} stroke={kind === 'poppy' ? '#986a66' : '#b6a083'}>{Array.from({ length: kind === 'poppy' ? 5 : 7 }, (_, index) => <ellipse key={index} cx="0" cy="-15" rx={kind === 'poppy' ? 10 : 7} ry="17" transform={`rotate(${index * (360 / (kind === 'poppy' ? 5 : 7))})`} opacity=".84" />)}</g><circle r="7" fill={kind === 'poppy' ? '#d9b587' : '#c29b75'} stroke="#9f8069" /></>;
}

function GardenActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const garden = state.garden;
  const board = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; before: GardenItem[]; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const updateGarden = (change: (value: MindfulnessState['garden']) => MindfulnessState['garden']) => setState((current) => ({ ...current, garden: change(current.garden) }));
  const place = (point: Point) => updateGarden((current) => ({ ...current, items: [...current.items, { id: newId(), kind: current.tool, x: point.x, y: point.y, rotation: (Math.random() - .5) * 18, scale: 1 }], history: [...current.history, current.items], selected: null, done: false }));
  const adjust = (change: (item: GardenItem) => GardenItem) => updateGarden((current) => ({ ...current, items: current.items.map((item) => item.id === current.selected ? change(item) : item), history: [...current.history, current.items], done: false }));
  return <div className="mini-activity-body">
    <div className="mini-controls mini-garden-palette"><span>Pick a clipping</span>{(['poppy', 'daisy', 'leaf', 'sprig', 'scrap'] as GardenKind[]).map((kind) => <button key={kind} className={`mini-palette-button ${garden.tool === kind ? 'selected' : ''}`} aria-pressed={garden.tool === kind} onClick={() => updateGarden((current) => ({ ...current, tool: kind, selected: null }))}>{kind === 'poppy' ? 'Poppy' : kind === 'daisy' ? 'Daisy' : kind === 'scrap' ? 'Paper scrap' : kind === 'sprig' ? 'Sprig' : 'Leaf'}</button>)}</div>
    <svg ref={board} className="mini-garden-board" viewBox="0 0 600 400" preserveAspectRatio="none" tabIndex={0} role="img" aria-label="Garden page. Choose a clipping and tap or press Enter to place it." onClick={(event) => { if (skipClick.current) { skipClick.current = false; return; } const bounds = event.currentTarget.getBoundingClientRect(); place({ x: clamp((event.clientX - bounds.left) / bounds.width * 600, 25, 575), y: clamp((event.clientY - bounds.top) / bounds.height * 400, 25, 375) }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); place({ x: 300, y: 200 }); } }} onPointerMove={(event) => { if (!drag.current) return; drag.current.moved = true; const point = pointFromEvent(event); const id = drag.current.id; updateGarden((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, x: clamp(point.x, 25, 575), y: clamp(point.y, 25, 375) } : item), done: false })); }} onPointerUp={() => { if (drag.current?.moved) { const before = drag.current.before; updateGarden((current) => ({ ...current, history: [...current.history, before] })); skipClick.current = true; } drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <rect width="600" height="400" fill="#f2e9d9" />
      <path d="M20 27H580V373H20Z" fill="none" stroke="#c7b7a1" strokeWidth="1.5" opacity=".6" />
      <path d="M70 350Q170 338 260 352M354 54Q458 44 540 57" fill="none" stroke="#b9a98d" opacity=".25" />
      {garden.items.map((item) => <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.scale})`} className={garden.selected === item.id ? 'garden-selected' : ''} onPointerDown={(event) => { event.stopPropagation(); skipClick.current = true; board.current?.setPointerCapture(event.pointerId); drag.current = { id: item.id, before: garden.items, moved: false }; updateGarden((current) => ({ ...current, selected: item.id })); }}><GardenMotif kind={item.kind} /></g>)}
      {garden.done && <text x="300" y="382" textAnchor="middle" className="garden-done-note">A small garden to leave on this page.</text>}
    </svg>
    <div className="mini-controls"><span className="mini-control-caption">Tap the page to place · drag to move</span><button className="quiet-button" disabled={garden.selected === null} onClick={() => adjust((item) => ({ ...item, rotation: item.rotation - 15 }))}>Rotate left</button><button className="quiet-button" disabled={garden.selected === null} onClick={() => adjust((item) => ({ ...item, rotation: item.rotation + 15 }))}>Rotate right</button><button className="quiet-button" disabled={garden.selected === null} onClick={() => adjust((item) => ({ ...item, scale: clamp(item.scale - .15, .5, 1.8) }))}>Smaller</button><button className="quiet-button" disabled={garden.selected === null} onClick={() => adjust((item) => ({ ...item, scale: clamp(item.scale + .15, .5, 1.8) }))}>Larger</button></div>
    {garden.items.length > 0 && <div className="mini-garden-list" aria-label="Placed clippings">{garden.items.map((item, index) => <button key={item.id} className={garden.selected === item.id ? 'selected' : ''} onClick={() => updateGarden((current) => ({ ...current, selected: item.id }))}>{item.kind} {index + 1}</button>)}</div>}
    <div className="mini-controls"><button className="quiet-button" disabled={!garden.history.length} onClick={() => updateGarden((current) => ({ ...current, items: current.history.at(-1) ?? [], history: current.history.slice(0, -1), selected: null, done: false }))}><Undo2 size={14} /> Undo</button><button className="quiet-button" disabled={garden.selected === null} onClick={() => updateGarden((current) => ({ ...current, items: current.items.filter((item) => item.id !== current.selected), history: [...current.history, current.items], selected: null, done: false }))}><Trash2 size={14} /> Remove selected</button><button className="quiet-button" disabled={!garden.items.length} onClick={() => updateGarden((current) => ({ ...current, items: [], history: [...current.history, current.items], selected: null, done: false }))}>Clear page</button><button className="primary-button" onClick={() => updateGarden((current) => ({ ...current, done: true }))}><Check size={15} /> Done for now</button></div>
    <p className="mini-help">There is no right arrangement. You can come back and move anything in this session.</p>
  </div>;
}

function RipplesActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const ripples = state.ripples;
  const reducedMotion = useReducedMotion();
  const setRipples = (patch: Partial<MindfulnessState['ripples']>) => setState((current) => ({ ...current, ripples: { ...current.ripples, ...patch } }));
  useEffect(() => {
    if (ripples.paused) return;
    const timer = window.setInterval(() => setState((current) => {
      const previous = current.ripples.clock;
      const clock = previous + .05;
      const waves = current.ripples.waves.filter((wave) => clock - wave.at < 5);
      if (current.ripples.watching && Math.floor(clock / 1.65) > Math.floor(previous / 1.65)) waves.push({ id: newId(), x: 90 + Math.random() * 420, y: 75 + Math.random() * 220, at: clock });
      return { ...current, ripples: { ...current.ripples, clock, waves } };
    }), 50);
    return () => window.clearInterval(timer);
  }, [ripples.paused, setState]);
  const addWave = (point: Point) => setState((current) => ({ ...current, ripples: { ...current.ripples, waves: [...current.ripples.waves, { id: newId(), x: point.x, y: point.y, at: current.ripples.clock }] } }));
  return <div className="mini-activity-body">
    <svg className="mini-ripple-board" viewBox="0 0 600 360" preserveAspectRatio="none" tabIndex={0} role="img" aria-label="Ink ripple page. Tap or press Enter to add a drop." onPointerDown={(event) => { const point = pointFromEvent(event, 600, 360); addWave(point); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addWave({ x: 300, y: 180 }); } }}>
      <defs><radialGradient id="ripple-wash"><stop stopColor="#f6f1e5" /><stop offset="1" stopColor="#e7e0cf" /></radialGradient></defs>
      <rect width="600" height="360" fill="url(#ripple-wash)" />
      {ripples.waves.map((wave) => { const age = ripples.clock - wave.at; const opacity = clamp(1 - age / 5, 0, 1); return <g key={wave.id} fill="none" stroke="#627780" opacity={opacity}>{reducedMotion ? <ellipse cx={wave.x} cy={wave.y} rx="19" ry="12" strokeWidth="2" /> : [0, 1, 2].map((ring) => <ellipse key={ring} cx={wave.x} cy={wave.y} rx={7 + Math.max(0, age - ring * .35) * 45} ry={4 + Math.max(0, age - ring * .35) * 28} strokeWidth={2 - ring * .35} opacity={age > ring * .35 ? 1 : 0} />)}<circle cx={wave.x} cy={wave.y} r="3" fill="#5c7078" opacity={clamp(1 - age)} /></g>; })}
    </svg>
    <div className="mini-controls"><button className={ripples.watching ? 'primary-button' : 'quiet-button'} aria-pressed={ripples.watching} onClick={() => setRipples({ watching: !ripples.watching, paused: false })}>{ripples.watching ? 'Stop automatic drops' : 'Watch without tapping'}</button><button className="quiet-button" onClick={() => setRipples({ paused: !ripples.paused })}>{ripples.paused ? <Play size={14} /> : <Pause size={14} />}{ripples.paused ? 'Resume' : 'Pause'}</button><button className="quiet-button" onClick={() => setRipples({ waves: [] })}><Trash2 size={14} /> Clear</button></div>
    <p className="mini-help">Tap anywhere, or simply watch the ink make its own slow circles.</p>
  </div>;
}

function playWaterSound() {
  try {
    const audio = new AudioContext();
    for (let index = 0; index < 3; index++) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(230 + index * 45, audio.currentTime + index * .28);
      oscillator.frequency.exponentialRampToValueAtTime(115 + index * 25, audio.currentTime + index * .28 + .2);
      gain.gain.setValueAtTime(.0001, audio.currentTime + index * .28);
      gain.gain.exponentialRampToValueAtTime(.035, audio.currentTime + index * .28 + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + index * .28 + .3);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(audio.currentTime + index * .28);
      oscillator.stop(audio.currentTime + index * .28 + .31);
    }
    window.setTimeout(() => { void audio.close().catch(() => {}); }, 1300);
  } catch { /* Audio is optional. */ }
}

function RocksActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const rocks = state.rocks;
  const reducedMotion = useReducedMotion();
  const swipeStart = useRef<Point | null>(null);
  const setRocks = (patch: Partial<MindfulnessState['rocks']>) => setState((current) => ({ ...current, rocks: { ...current.rocks, ...patch } }));
  useEffect(() => {
    if (!rocks.running) return;
    const timer = window.setInterval(() => setState((current) => {
      const progress = Math.min(1, current.rocks.progress + .015);
      return { ...current, rocks: { ...current.rocks, progress, running: progress < 1, settling: progress >= 1 } };
    }), 40);
    return () => window.clearInterval(timer);
  }, [rocks.running, setState]);
  useEffect(() => {
    if (!rocks.settling) return;
    const timer = window.setTimeout(() => setRocks({ settling: false }), 700);
    return () => window.clearTimeout(timer);
  }, [rocks.settling]);
  const throwStone = () => { if (rocks.running || rocks.settling) return; setRocks(reducedMotion ? { progress: 1, running: false, settling: true } : { progress: 0, running: true }); if (rocks.sound) playWaterSound(); };
  const progress = rocks.progress;
  const stoneX = 75 + progress * 450;
  const stoneY = 213 - Math.abs(Math.sin(progress * Math.PI * 3)) * (45 - progress * 15);
  return <div className="mini-activity-body">
    <svg className="mini-pond" viewBox="0 0 600 360" preserveAspectRatio="none" role="img" aria-label="Watercolor pond. Swipe across to skip a stone." onPointerDown={(event) => { swipeStart.current = pointFromEvent(event, 600, 360); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { const end = pointFromEvent(event, 600, 360); if (swipeStart.current && Math.hypot(end.x - swipeStart.current.x, end.y - swipeStart.current.y) > 25) throwStone(); swipeStart.current = null; }} onPointerCancel={() => { swipeStart.current = null; }}>
      <defs><linearGradient id="pond-water" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b8cac2" /><stop offset="1" stopColor="#7f9d9d" /></linearGradient></defs>
      <rect width="600" height="360" fill="#ede5d4" />
      <path d="M0 94Q96 112 180 86T360 104T600 85V360H0Z" fill="url(#pond-water)" />
      <path d="M0 95Q88 112 175 88T360 104T600 85" fill="none" stroke="#b6a68c" strokeWidth="10" opacity=".66" />
      <path d="M30 262Q149 246 271 258T556 250M55 305Q190 293 324 304T564 299" fill="none" stroke="#dbe4d9" strokeWidth="2" opacity=".5" />
      {[.25, .52, .79].map((stop) => progress > stop && <g key={stop} fill="none" stroke="#e9eee5" opacity={clamp(1 - (progress - stop) * 1.4)}><ellipse cx={75 + stop * 450} cy="213" rx={12 + (progress - stop) * 70} ry={4 + (progress - stop) * 22} /><ellipse cx={75 + stop * 450} cy="213" rx={5 + (progress - stop) * 38} ry={2 + (progress - stop) * 12} /></g>)}
      {rocks.running && <ellipse cx={stoneX} cy={stoneY} rx="14" ry="6" fill="#756e63" stroke="#5e5c57" strokeWidth="1.5" />}
      {!rocks.running && <path d="M48 225Q65 212 83 223L89 229Q67 237 47 230Z" fill="#82796b" stroke="#5d5c58" strokeWidth="1.5" />}
      <path d="M0 338Q137 322 237 340T600 330V360H0Z" fill="#c8bba2" opacity=".73" />
    </svg>
    <div className="mini-controls mini-controls-center"><button className="primary-button" disabled={rocks.running || rocks.settling} onClick={throwStone}>{rocks.running || rocks.settling ? 'Let it settle…' : 'Skip a stone'}</button><button className="quiet-button" aria-pressed={rocks.sound} onClick={() => setRocks({ sound: !rocks.sound })}>{rocks.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}{rocks.sound ? 'Water sound on' : 'Water sound off'}</button></div>
    <p className="mini-help">Swipe across the pond, or use the button. There is no perfect throw.</p>
  </div>;
}

function FudeCursor({ point, size, drawing }: { point: Point; size: number; drawing: boolean }) {
  return <g className={`mini-fude-cursor ${drawing ? 'is-drawing' : ''}`} transform={`translate(${point.x} ${point.y}) rotate(36)`} aria-hidden="true">
    <ellipse cx="0" cy="2" rx={Math.max(2.2, size * .3)} ry="1.8" fill="#405456" opacity=".32" />
    <path d="M0 1C-5-8-7-20-4-29L4-29C7-20 5-8 0 1Z" fill="#2f3f40" stroke="#263536" strokeWidth="1" />
    <path d="M-4-29L-5-38H5L4-29Z" fill="#b9975d" stroke="#786446" strokeWidth="1" />
    <path d="M-5-38L-4-82Q0-88 4-82L5-38Z" fill="#773d4e" stroke="#5d3140" strokeWidth="1.2" />
    <path d="M-1.5-78L-1-43" stroke="#c88a88" strokeWidth="1.2" opacity=".55" />
    <path d="M-4-82Q0-89 4-82" fill="#c2a36b" stroke="#786446" strokeWidth="1" />
  </g>;
}

function WaterActivity({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const water = state.water;
  const reducedMotion = useReducedMotion();
  const drawing = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 300, y: 200 });
  const [brushCursor, setBrushCursor] = useState<Point | null>(null);
  const setWater = (patch: Partial<MindfulnessState['water']>) => setState((current) => ({ ...current, water: { ...current.water, ...patch } }));
  const addKeyboardStroke = (points: Point[]) => setState((current) => ({ ...current, water: { ...current.water, strokes: [...current.water.strokes, { id: newId(), points, color: '#4b6163', size: current.water.size, at: current.water.clock }] } }));
  useEffect(() => {
    if (water.drying === 'paused' || reducedMotion) return;
    const timer = window.setInterval(() => setState((current) => ({ ...current, water: { ...current.water, clock: current.water.clock + (current.water.drying === 'slow' ? .018 : .05) } })), 50);
    return () => window.clearInterval(timer);
  }, [water.drying, reducedMotion, setState]);
  const finish = () => { if (!drawing.current) return; const stroke = drawing.current; setState((current) => ({ ...current, water: { ...current.water, strokes: [...current.water.strokes, stroke] } })); drawing.current = null; setLive(null); };
  const renderStroke = (stroke: Stroke) => {
    const age = water.clock - stroke.at;
    const opacity = clamp(1 - age / 13, 0, 1) * .72;
    if (opacity <= 0) return null;
    return <g key={stroke.id} opacity={opacity} stroke={stroke.color} strokeLinecap="round" strokeLinejoin="round">{stroke.points.length === 1 ? <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={stroke.size * .38} fill={stroke.color} /> : stroke.points.slice(1).map((point, index) => { const previous = stroke.points[index]; const taper = .28 + .72 * Math.sin((index + 1) / stroke.points.length * Math.PI); return <line key={index} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} strokeWidth={stroke.size * taper} />; })}</g>;
  };
  return <div className="mini-activity-body">
    <div className="mini-controls"><label>Brush size <select value={water.size} onChange={(event) => setWater({ size: Number(event.target.value) })}><option value="5">Fine</option><option value="9">Medium</option><option value="16">Broad</option></select></label><label>Drying <select value={water.drying} onChange={(event) => setWater({ drying: event.target.value as MindfulnessState['water']['drying'] })}><option value="normal">Gentle</option><option value="slow">Slower</option><option value="paused">Paused</option></select></label><button className="quiet-button" onClick={() => setWater({ strokes: [] })}><Trash2 size={14} /> Clear</button></div>
    <svg className="mini-water-board" viewBox="0 0 600 400" preserveAspectRatio="none" tabIndex={0} role="img" aria-label="Water brush surface. Use touch or mouse, or arrow keys to move, Space to mark, and Shift with arrows to draw." onKeyDown={(event) => { const step = 16; const offsets: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }; const offset = offsets[event.key]; if (offset) { event.preventDefault(); const next = { x: clamp(cursor.x + offset.x, 0, 600), y: clamp(cursor.y + offset.y, 0, 400) }; if (event.shiftKey) addKeyboardStroke([cursor, next]); setCursor(next); } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addKeyboardStroke([cursor]); } }} onPointerEnter={(event) => { if (event.pointerType !== 'touch') setBrushCursor(pointFromEvent(event)); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const point = pointFromEvent(event); if (event.pointerType !== 'touch') setBrushCursor(point); const stroke = { id: newId(), points: [point], color: '#4b6163', size: water.size, at: water.clock }; drawing.current = stroke; setLive(stroke); }} onPointerMove={(event) => { const point = pointFromEvent(event); if (event.pointerType !== 'touch') setBrushCursor(point); if (!drawing.current) return; const stroke = { ...drawing.current, points: [...drawing.current.points, point] }; drawing.current = stroke; setLive(stroke); }} onPointerUp={(event) => { if (event.pointerType !== 'touch') setBrushCursor(pointFromEvent(event)); finish(); }} onPointerCancel={() => { setBrushCursor(null); finish(); }} onPointerLeave={() => { if (!drawing.current) setBrushCursor(null); }}>
      <rect width="600" height="400" fill="#d9d7c9" />
      <path d="M19 25H581V375H19Z" fill="none" stroke="#b7b5a7" strokeWidth="2" />
      {water.strokes.map(renderStroke)}{live && renderStroke(live)}
      <FudeCursor point={brushCursor ?? cursor} size={water.size} drawing={Boolean(live)} />
    </svg>
    <p className="mini-help">Write a word, draw a symbol, or follow the brush wherever it goes. {reducedMotion ? 'Drying stays paused while reduced motion is on.' : 'The water dries on its own.'}</p>
  </div>;
}

export function MindfulnessMinigames({ state, setState, onSupport }: Props) {
  const current = state.current;
  const open = (activity: ActivityId | null) => setState((previous) => ({ ...previous, current: activity }));
  const currentName = activities.find((activity) => activity.id === current)?.name;
  return <div className="spread minigames-spread" data-testid="page-minigames">
    <section className="sheet minigames-sheet mini-games-page"><div className="sheet-content">
      <div className="sheet-rubric eyebrow"><span>A little room to pause</span><span className="page-no">07 / 08</span></div>
      <div className="mini-topbar">{current ? <button className="mini-back" onClick={() => open(null)}><ArrowLeft size={16} /> Back to minigames</button> : <span className="mini-topbar-spacer" />}<button className="mini-support" onClick={onSupport}><ShieldCheck size={15} /> Get support</button></div>
      {current ? <div key={current} className="mini-paper-in"><div className="mini-intro"><h3>{currentName}</h3><p>{activities.find((activity) => activity.id === current)?.hint}</p></div>
        {current === 'breath' && <BreathActivity state={state} setState={setState} />}
        {current === 'doodles' && <DoodlesActivity state={state} setState={setState} />}
        {current === 'folding' && <FoldingActivity state={state} setState={setState} />}
        {current === 'garden' && <GardenActivity state={state} setState={setState} />}
        {current === 'ripples' && <RipplesActivity state={state} setState={setState} />}
        {current === 'rocks' && <RocksActivity state={state} setState={setState} />}
        {current === 'water' && <WaterActivity state={state} setState={setState} />}
      </div> : <Launcher onOpen={open} />}
    </div></section>
    <section className="sheet mini-note-page"><div className="sheet-content">
      <div className="sheet-rubric eyebrow"><span>A note beside the games</span><span className="page-no">08 / 08</span></div>
      <div className="mini-note-content">
        <div className="eyebrow">A small invitation</div>
        <h3>Hopefully these little games help.</h3>
        <p>We hope they offer a softer moment to pause, make something, or simply watch. Choose what feels inviting today.</p>
        <p>There is no score, right pace, or finish line. You can leave a game unfinished and come back during this visit.</p>
        <svg className="mini-note-flower" viewBox="0 0 240 220" aria-hidden="true"><path d="M120 187Q115 123 124 70" fill="none" stroke="#77866d" strokeWidth="2" /><path d="M118 147Q87 122 64 135Q82 158 119 156M121 129Q152 106 178 116Q158 139 122 137" fill="#a7b394" stroke="#7d8c76" strokeWidth="1.5" /><g fill="#ca9284" opacity=".76" stroke="#9f786d" strokeWidth="1.2"><ellipse cx="122" cy="53" rx="15" ry="32" /><ellipse cx="122" cy="53" rx="15" ry="32" transform="rotate(60 122 76)" /><ellipse cx="122" cy="53" rx="15" ry="32" transform="rotate(120 122 76)" /><ellipse cx="122" cy="53" rx="15" ry="32" transform="rotate(180 122 76)" /><ellipse cx="122" cy="53" rx="15" ry="32" transform="rotate(240 122 76)" /><ellipse cx="122" cy="53" rx="15" ry="32" transform="rotate(300 122 76)" /></g><circle cx="122" cy="76" r="13" fill="#e5cb96" stroke="#9f8063" strokeWidth="1.5" /></svg>
        <div className="mini-note-end eyebrow">For this moment, that is enough.</div>
      </div>
    </div></section>
  </div>;
}
