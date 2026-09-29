import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { advancePetalRun, createPetalRun, makePetalChart, pausePetalRun, pressPetalLane, releasePetalLane, PETAL_TIMING_WINDOW } from '../src/petalKeysLogic.ts';

const scores = JSON.parse(readFileSync(new URL('../src/petalSongData.json', import.meta.url), 'utf8')) as { id: string; rank: number; bpm: number; difficulty: string; notes: number[][] }[];
const chartFor = (song: typeof scores[number]) => makePetalChart(song.notes.map(([at, midi, duration]) => ({ at, midi, duration })), song.bpm);
const twoNotes = () => makePetalChart([{ at: 0, midi: 60, duration: 2 }, { at: 2, midi: 64, duration: 1 }], 100);

test('a hold starts without scoring; releasing early costs exactly one chance', () => {
  const run = createPetalRun(twoNotes()), note = run.notes[0];
  advancePetalRun(run, note.at);
  assert.equal(pressPetalLane(run, note.lane)?.kind, 'hold');
  assert.equal(run.score, 0);
  advancePetalRun(run, .25);
  assert.equal(releasePetalLane(run, note.lane)?.reason, 'early');
  assert.equal(run.mistakes, 1);
  releasePetalLane(run, note.lane); advancePetalRun(run, .5);
  assert.equal(run.mistakes, 1);
  assert.equal(run.score, 0);
});

test('a completed hold awards its bonus once and key repeat cannot trigger another note', () => {
  const run = createPetalRun(twoNotes()), note = run.notes[0];
  advancePetalRun(run, note.at); pressPetalLane(run, note.lane);
  assert.equal(pressPetalLane(run, note.lane), undefined);
  advancePetalRun(run, note.holdFor + .001);
  assert.equal(run.score, 40); assert.equal(run.hits, 1);
  assert.equal(releasePetalLane(run, note.lane), undefined);
  assert.equal(run.score, 40);
});

test('release tolerance is forgiving near the end, but not halfway through', () => {
  const run = createPetalRun(twoNotes()), note = run.notes[0];
  advancePetalRun(run, note.at); pressPetalLane(run, note.lane);
  advancePetalRun(run, note.holdFor - .08);
  assert.equal(releasePetalLane(run, note.lane)?.kind, 'held');
  assert.equal(run.mistakes, 0);
});

test('pause during a hold freezes the song until the player re-holds the key', () => {
  const run = createPetalRun(twoNotes()), note = run.notes[0];
  advancePetalRun(run, note.at); pressPetalLane(run, note.lane); advancePetalRun(run, .3);
  pausePetalRun(run); const pausedAt = run.time;
  advancePetalRun(run, 20); releasePetalLane(run, note.lane);
  assert.equal(run.time, pausedAt); assert.equal(run.mistakes, 0);
  assert.equal(pressPetalLane(run, note.lane)?.kind, 'rehold');
  assert.equal(run.awaitingRehold, false);
  advancePetalRun(run, note.holdFor - .3 + .001);
  assert.equal(run.score, 40); assert.equal(run.mistakes, 0);
});

test('taps require a fresh press and the correct lane inside the timing window', () => {
  const chart = makePetalChart([{ at: 0, midi: 60, duration: .5 }, { at: .5, midi: 60, duration: .5 }], 100);
  const run = createPetalRun(chart), note = run.notes[0];
  advancePetalRun(run, note.at); pressPetalLane(run, note.lane);
  assert.equal(run.score, 20);
  advancePetalRun(run, .3); pressPetalLane(run, note.lane);
  assert.equal(run.score, 20, 'keeping the key down does not play repeated notes');
  releasePetalLane(run, note.lane); pressPetalLane(run, note.lane);
  assert.equal(run.score, 40);
});

test('three slips end Play mode; count-in presses do not cost chances', () => {
  const run = createPetalRun(twoNotes());
  pressPetalLane(run, 3); assert.equal(run.mistakes, 0);
  advancePetalRun(run, 2.4);
  for (let i = 0; i < 3; i++) { pressPetalLane(run, 3); releasePetalLane(run, 3); }
  assert.equal(run.finished, true); assert.equal(run.completed, false);
  const score = run.score; pressPetalLane(run, 0); assert.equal(run.score, score);
});

test('Practice can reach the end despite missing every note', () => {
  const run = createPetalRun(chartFor(scores[0]), true);
  advancePetalRun(run, run.end + 1);
  assert.equal(run.mistakes, 42); assert.equal(run.completed, true);
});

test('all 17 song charts can be played to completion, including every hold', () => {
  assert.equal(scores.length, 17);
  assert.equal(new Set(scores.map(song => song.id)).size, 17);
  assert.deepEqual(scores.map(song => song.rank), Array.from({ length: 17 }, (_, i) => i + 1));
  for (const song of scores) {
    const chart = chartFor(song), run = createPetalRun(chart);
    assert.ok(chart.length >= 20, song.id);
    for (const note of chart) {
      assert.ok(note.midi >= 45 && note.midi <= 96, `${song.id}: playable register`);
      assert.ok(note.duration > 0 && note.at >= run.time - .001, `${song.id}: ordered notes`);
      advancePetalRun(run, Math.max(0, note.at - run.time));
      const event = pressPetalLane(run, note.lane);
      assert.ok(event?.kind === 'tap' || event?.kind === 'hold', `${song.id}: note ${note.id} can be hit`);
      if (note.holdFor) advancePetalRun(run, note.holdFor + .001);
      releasePetalLane(run, note.lane);
    }
    advancePetalRun(run, run.end - run.time + .01);
    assert.equal(run.mistakes, 0, song.id); assert.equal(run.hits, chart.length, song.id);
    assert.equal(run.completed, true, song.id);
  }
});

test('ribbons are frequent, leave room to release, and never stretch the score rhythm', () => {
  let holds = 0;
  for (const song of scores) {
    const chart = chartFor(song);
    for (const [index, note] of chart.entries()) {
      if (!note.holdFor) continue;
      holds++;
      assert.ok(note.holdFor >= .35, `${song.id}: playable hold`);
      assert.ok(note.holdFor <= note.duration, `${song.id}: preserve note length`);
      if (chart[index + 1]) assert.ok(note.at + note.holdFor + .119 <= chart[index + 1].at, `${song.id}: release space`);
    }
  }
  assert.ok(holds >= 140, 'enough ribbons throughout the songbook');
  assert.equal(chartFor(scores[0]).filter(note => note.holdFor).length, 24);
  for (const id of ['melody', 'canon', 'fur-elise', 'turkish-march']) {
    assert.ok(chartFor(scores.find(song => song.id === id)!).some(note => note.holdFor), `${id} now includes ribbons`);
  }
});

test('new arrangements retain the checked openings and contain no impossible grace-note tiles', () => {
  const pitches = (id: string, count: number) => scores.find(song => song.id === id)!.notes.slice(0, count).map(note => note[1]);
  assert.deepEqual(pitches('waltz-a-minor', 8), [64, 69, 71, 72, 72, 74, 76, 77]);
  assert.deepEqual(pitches('loves-sorrow', 11), [64, 63, 64, 65, 64, 66, 63, 67, 62, 68, 61]);
  assert.deepEqual(pitches('ballade-no-1', 5), [48, 51, 56, 58, 60]);
  for (const song of scores) {
    const chart = chartFor(song);
    for (let i = 1; i < chart.length; i++) {
      assert.ok(chart[i].at - chart[i - 1].at >= (song.id === 'bumblebee' ? .1 : .115), `${song.id}: readable spacing at ${i}`);
    }
  }
});

test('Bumblebee is the last and fastest chart, with its authentic chromatic opening', () => {
  const boss = scores.at(-1)!;
  assert.equal(boss.id, 'bumblebee'); assert.equal(boss.difficulty, 'Final boss');
  assert.equal(boss.bpm, 144);
  assert.deepEqual(boss.notes.slice(0, 8).map(note => note[1]), [88, 87, 86, 85, 86, 85, 84, 83]);
  assert.ok(boss.notes.length > 700, 'a full-length endurance chart');
  const density = (song: typeof boss) => {
    const chart = chartFor(song);
    return chart.length / (chart.at(-1)!.at + chart.at(-1)!.duration - chart[0].at);
  };
  assert.ok(scores.slice(0, -1).every(song => density(song) < density(boss)));
  const chart = chartFor(boss);
  for (let i = 1; i < chart.length; i++) {
    if (chart[i].at - chart[i - 1].at < .14) assert.notEqual(chart[i].lane, chart[i - 1].lane, 'rapid taps alternate fingers');
  }
  assert.equal(scores.find(song => song.id === 'loves-sorrow')!.bpm, 96);
});

test('a dense repeated lane judges the closest note and a tap cannot finish a ribbon', () => {
  const chart = makePetalChart([{ at: 0, midi: 60, duration: .25 }, { at: .25, midi: 60, duration: .25 }], 120)
    .map(note => ({ ...note, lane: 0 }));
  const run = createPetalRun(chart);
  advancePetalRun(run, chart[1].at);
  assert.equal(pressPetalLane(run, 0)?.note?.id, 1);
  const held = createPetalRun(twoNotes());
  advancePetalRun(held, held.notes[0].at);
  pressPetalLane(held, 0); releasePetalLane(held, 0);
  assert.equal(held.score, 0); assert.equal(held.mistakes, 1);
});

test('the three requested tunes retain their recognizable opening pitches', () => {
  const pitches = (id: string, length: number) => scores.find(song => song.id === id)!.notes.slice(0, length).map(note => note[1]);
  assert.deepEqual(pitches('twinkle', 7), [60, 60, 67, 67, 69, 69, 67]);
  assert.deepEqual(pitches('fur-elise', 9), [76, 75, 76, 75, 76, 71, 74, 72, 69]);
  assert.deepEqual(pitches('turkish-march', 5), [71, 69, 68, 69, 72]);
});

test('a long frame cannot award missed notes or complete a failed song', () => {
  const run = createPetalRun(chartFor(scores[0]));
  advancePetalRun(run, run.end + PETAL_TIMING_WINDOW);
  assert.equal(run.mistakes, 3); assert.equal(run.hits, 0); assert.equal(run.completed, false);
});
