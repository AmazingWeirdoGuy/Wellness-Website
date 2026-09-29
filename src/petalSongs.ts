import scores from './petalSongData.json';
import { makePetalChart } from './petalKeysLogic';

export const PETAL_SONGS = scores.map(song => {
  const chart = makePetalChart(song.notes.map(([at, midi, duration]) => ({ at, midi, duration })), song.bpm);
  const last = chart.at(-1)!;
  return { ...song, chart, seconds: Math.ceil(last.at + last.duration - chart[0].at), holds: chart.filter(note => note.holdFor > 0).length };
});
export type PetalSong = (typeof PETAL_SONGS)[number];
