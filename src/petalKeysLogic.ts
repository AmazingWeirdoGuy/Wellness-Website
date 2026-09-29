export type PetalScoreNote = { at: number; midi: number; duration: number };
export type PetalChartNote = PetalScoreNote & { id: number; lane: number; holdFor: number };
export type PetalStateNote = PetalChartNote & { state: 'pending' | 'holding' | 'hit' | 'missed'; perfect: boolean };
export type PetalRun = {
  notes: PetalStateNote[]; time: number; end: number; score: number; combo: number;
  hits: number; mistakes: number; pressed: boolean[]; flashes: number[];
  awaitingRehold: boolean; finished: boolean; completed: boolean; practice: boolean;
};
export type PetalEvent = { kind: 'tap' | 'hold' | 'held' | 'miss' | 'rehold'; note?: PetalStateNote; reason?: 'early' | 'late' | 'empty' };
export const PETAL_LEAD_IN = 2.4;
export const PETAL_TIMING_WINDOW = .16;
export const PETAL_RELEASE_GRACE = .1;
export const PETAL_LINE = 356;

// Four buttons trigger the score's actual pitches, not four fixed piano notes.
export function makePetalChart(score: readonly PetalScoreNote[], bpm: number): PetalChartNote[] {
  const seconds = 60 / bpm;
  const pitches = [...new Set(score.map(note => note.midi))].sort((a, b) => a - b);
  let shortHolds = 0;
  let previousLane = -1;
  return score.map((note, id) => {
    const gap = id + 1 < score.length ? score[id + 1].at - note.at : note.duration;
    const duration = Math.max(.04, Math.min(note.duration, gap)) * seconds;
    // Sustained notes always become ribbons. Alternate shorter, playable notes
    // with taps; fast runs keep their written rhythm rather than artificial holds.
    const canHold = duration >= .48;
    const ribbon = canHold && (note.duration >= 1.5 || duration >= .78
      || ++shortHolds % 2 === 0 || id === score.length - 1);
    // Leave time to lift and re-press, including two notes in the same lane.
    const holdFor = ribbon ? duration - .12 : 0;
    let lane = [0, 1, 2, 3, 2, 1][pitches.indexOf(note.midi) % 6];
    // Rapid repetitions alternate fingers instead of requiring a 10 Hz double-tap.
    if (id > 0 && lane === previousLane && (note.at - score[id - 1].at) * seconds < .14) {
      lane = lane === 3 ? 2 : lane + 1;
    }
    previousLane = lane;
    return { id, midi: note.midi, at: PETAL_LEAD_IN + note.at * seconds, duration,
      lane, holdFor };
  });
}

export function createPetalRun(chart: readonly PetalChartNote[], practice = false): PetalRun {
  return {
    notes: chart.map(note => ({ ...note, state: 'pending', perfect: false })), time: 0,
    end: chart.length ? Math.max(...chart.map(note => note.at + note.duration)) : 0,
    score: 0, combo: 0, hits: 0, mistakes: 0, pressed: [false, false, false, false],
    flashes: [0, 0, 0, 0], awaitingRehold: false, finished: false, completed: false, practice,
  };
}

function complete(run: PetalRun, note: PetalStateNote): PetalEvent {
  note.state = 'hit'; run.hits++; run.combo++;
  run.score += (note.perfect ? 20 : 10) + (note.holdFor ? 20 : 0);
  run.flashes[note.lane] = .3;
  return { kind: note.holdFor ? 'held' : 'tap', note };
}
function miss(run: PetalRun, note?: PetalStateNote, reason: PetalEvent['reason'] = 'late'): PetalEvent {
  if (note) note.state = 'missed';
  run.combo = 0; run.mistakes++;
  if (run.mistakes >= 3 && !run.practice) run.finished = true;
  return { kind: 'miss', note, reason };
}
export function pressPetalLane(run: PetalRun, lane: number): PetalEvent | undefined {
  if (run.finished || lane < 0 || lane > 3 || run.pressed[lane]) return;
  if (run.time < PETAL_LEAD_IN - PETAL_TIMING_WINDOW) return;
  run.pressed[lane] = true; run.flashes[lane] = .2;
  const held = run.notes.find(note => note.lane === lane && note.state === 'holding');
  if (held) {
    run.awaitingRehold = run.notes.some(note => note.state === 'holding' && !run.pressed[note.lane]);
    return { kind: 'rehold', note: held };
  }
  // Reacquiring a paused hold must not penalize other keys while the score is frozen.
  if (run.awaitingRehold) return;
  // Dense runs can put two notes inside the hit window. Judge the nearest one.
  const note = run.notes.filter(note => note.state === 'pending' && note.lane === lane
    && Math.abs(note.at - run.time) <= PETAL_TIMING_WINDOW)
    .reduce<PetalStateNote | undefined>((nearest, candidate) => !nearest
      || Math.abs(candidate.at - run.time) < Math.abs(nearest.at - run.time) ? candidate : nearest, undefined);
  if (!note) return miss(run, undefined, 'empty');
  note.perfect = Math.abs(note.at - run.time) <= .075;
  if (!note.holdFor) return complete(run, note);
  note.state = 'holding';
  return { kind: 'hold', note };
}
export function releasePetalLane(run: PetalRun, lane: number): PetalEvent | undefined {
  run.pressed[lane] = false;
  if (run.finished) return;
  const held = run.notes.find(note => note.lane === lane && note.state === 'holding');
  if (!held || run.awaitingRehold) return;
  return run.time + PETAL_RELEASE_GRACE >= held.at + held.holdFor ? complete(run, held) : miss(run, held, 'early');
}
export function pausePetalRun(run: PetalRun) {
  run.pressed.fill(false);
  run.awaitingRehold = run.notes.some(note => note.state === 'holding');
}
export function advancePetalRun(run: PetalRun, dt: number): PetalEvent[] {
  if (run.finished || run.awaitingRehold) return [];
  run.time += Math.max(0, dt);
  run.flashes = run.flashes.map(value => Math.max(0, value - dt));
  const events: PetalEvent[] = [];
  for (const note of run.notes) {
    if (run.finished) break;
    if (note.state === 'holding' && run.time >= note.at + note.holdFor) events.push(complete(run, note));
    else if (note.state === 'pending' && run.time > note.at + PETAL_TIMING_WINDOW) events.push(miss(run, note));
  }
  if (!run.finished && run.time >= run.end && run.notes.every(note => note.state === 'hit' || note.state === 'missed')) {
    run.finished = true; run.completed = true;
  }
  return events;
}
