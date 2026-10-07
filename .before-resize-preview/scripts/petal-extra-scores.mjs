// Hand-checked melody reductions. Beat units are quarter notes, not seconds.
// Only public-domain compositions/editions; no recordings are bundled.
const publicDomain = { license: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/' };
const melody = notation => {
  let beat = 0;
  return notation.trim().split(/\s+/).flatMap(token => {
    const [pitch, length = '1'] = token.split(':');
    const duration = Number(length), at = beat; beat += duration;
    if (pitch === 'r') return [];
    const [, name, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(pitch);
    const midi = (Number(octave) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name]
      + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    return [[at, midi, duration]];
  });
};

export const EXTRA_PETAL_SCORES = [
  {
    id: 'waltz-a-minor', title: 'Waltz in A Minor, B. 150', composer: 'Frédéric Chopin', bpm: 104, difficulty: 'Moderate',
    sourceUrl: 'https://musetrainer.github.io/library/scores/Waltz_in_A_MinorChopin.mxl',
    credit: 'MuseTrainer public-domain score library · opening melody, ornamentation simplified', ...publicDomain,
    // Right-hand line, through the E-major cadence. Retain the written rests.
    notes: melody(`
      E4 A4:.5 B4:.5 C5 C5 D5:.5 E5:.5 F5:2 B4:.5 C5:.5
      D5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D#5:.5 E5:2 A4:.5 B4:.5
      C5 C5 D5:.5 E5:.5 F5:2 B4:.5 C5:.5 D5:.5 A5:.5 G5:.5 B4:.5 C5 r
      E4 A4:.5 B4:.5 C5 C5 D5:.5 E5:.5 F5:2 B4:.5 C5:.5
      D5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D#5:.5 E5:2 C5:.5 D5:.5
      E5 E5 F5:.5 G5:.5 A5:2 G5 F#5:.5 G5:.5 D6:.5 F5:.5 E5:3
    `),
  },
  {
    id: 'loves-sorrow', title: 'Love’s Sorrow (Liebesleid)', composer: 'Fritz Kreisler · arr. Sergei Rachmaninoff', bpm: 96, difficulty: 'Moderate',
    sourceUrl: 'https://imslp.org/wiki/3_Old_Viennese_Dances_(Kreisler,_Fritz)#For_Piano_(Rachmaninoff)',
    credit: 'Charles Foley first edition, 1923 · opening 14 bars; melody only, grace notes omitted',
    license: 'Public domain in the US', licenseUrl: 'https://imslp.org/wiki/3_Old_Viennese_Dances_(Kreisler,_Fritz)',
    // Checked against IMSLP #293942, page 1. Ties across bar lines are single notes.
    // The pickup rest is omitted so the first playable note follows the count-in.
    notes: melody(`
      E4:.5 D#4:.5 E4:.5 F4:.5 E4:.5
      F#4:.5 D#4:.5 G4:.5 D4:.5 G#4:.5 C#4:.5
      A4:2 E5:2 E5:1.5 E5:.5
      E5 D5 r:.5 E5:.5 F5:3
      G4:2 D5:2 D5:1.5 D5:.5
      D5 C5 r:.5 D5:.5 E5:3
      E4:2 B4:2 B4:1.5 B4:.5
      B4 Bb4 r:.5 B4:.5 C5:3
    `),
  },
];
