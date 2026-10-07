// Development-only importer. Runtime uses the small, bundled JSON scorebook.
// Usage: node scripts/import-petal-scores.mjs <directory-of-Mutopia-MIDI-files>
import fs from 'node:fs';
import path from 'node:path';
import { EXTRA_PETAL_SCORES } from './petal-extra-scores.mjs';

function readMidi(file) {
  const data = fs.readFileSync(file);
  if (data.toString('ascii', 0, 4) !== 'MThd') throw new Error(`Not MIDI: ${file}`);
  const ppq = data.readUInt16BE(12);
  if (ppq & 0x8000) throw new Error('SMPTE time is unsupported');
  let cursor = 8 + data.readUInt32BE(4);
  const tracks = [];
  while (cursor < data.length) {
    const length = data.readUInt32BE(cursor + 4), end = cursor + 8 + length;
    cursor += 8;
    let tick = 0, running = 0, name = '';
    const notes = [], active = new Map();
    const variable = () => { let n = 0, byte; do { byte = data[cursor++]; n = (n << 7) | (byte & 127); } while (byte & 128); return n; };
    while (cursor < end) {
      tick += variable();
      let status = data[cursor];
      if (status & 128) { cursor++; if (status < 0xf0) running = status; } else status = running;
      if (status === 0xff) {
        const type = data[cursor++], size = variable();
        if (type === 3) name = data.toString('utf8', cursor, cursor + size);
        cursor += size; continue;
      }
      if (status === 0xf0 || status === 0xf7) { const size = variable(); cursor += size; continue; }
      const kind = status >> 4, channel = status & 15;
      const pitch = data[cursor++], value = kind === 12 || kind === 13 ? 0 : data[cursor++];
      const key = `${channel}:${pitch}`;
      if (kind === 9 && value > 0) active.set(key, tick);
      else if ((kind === 8 || kind === 9) && active.has(key)) {
        const start = active.get(key); active.delete(key);
        notes.push({ at: start / ppq, midi: pitch, duration: (tick - start) / ppq, channel });
      }
    }
    tracks.push({ name, notes: notes.sort((a, b) => a.at - b.at || b.midi - a.midi) });
    cursor = end;
  }
  return tracks;
}

// Offline reader for the archived MuseTrainer score-partwise MusicXML file.
// No external entities, network requests, or notation dependencies are evaluated.
function readBumblebee(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const part = xml.match(/<part\s+id="P1">([\s\S]*?)<\/part>/)?.[1];
  if (!part || !xml.includes('Hummelflug')) throw new Error('Expected the MuseTrainer Bumblebee score');
  const value = (text, tag, fallback = '') => text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? fallback;
  const notes = [], ties = new Map();
  let beat = 0, divisions = 1;
  for (const measure of part.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)) {
    let cursor = 0, previousAt = 0, length = 0;
    for (const match of measure[1].matchAll(/<(attributes|backup|forward|note)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const [, kind, body] = match;
      if (kind === 'attributes') { divisions = Number(value(body, 'divisions', String(divisions))); continue; }
      const duration = Number(value(body, 'duration', '0')) / divisions;
      if (kind === 'backup') { cursor -= duration; continue; }
      if (kind === 'forward') { cursor += duration; length = Math.max(length, cursor); continue; }
      const chord = /<chord\s*\/>/.test(body), at = beat + (chord ? previousAt : cursor);
      if (body.includes('<pitch>') && duration > 0) {
        const midi = (Number(value(body, 'octave')) + 1) * 12
          + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[value(body, 'step')]
          + Number(value(body, 'alter', '0'));
        const key = `${value(body, 'staff')}:${value(body, 'voice')}:${midi}`;
        let note = /<tie\b[^>]*type="stop"/.test(body) ? ties.get(key) : undefined;
        if (note) note.duration += duration;
        else { note = { at, midi, duration }; notes.push(note); }
        if (/<tie\b[^>]*type="start"/.test(body)) ties.set(key, note); else ties.delete(key);
      }
      if (!chord) { previousAt = cursor; cursor += duration; }
      length = Math.max(length, cursor);
    }
    beat += length;
  }
  // The running sixteenth-note figure passes between hands. Prefer that voice
  // over accompanying chords, then take the upper pitch at a shared onset.
  const ordered = notes.sort((a, b) => a.at - b.at || a.duration - b.duration || b.midi - a.midi);
  return [{ name: 'Bumblebee running melody', notes: ordered.filter((note, index) => !index || note.at !== ordered[index - 1].at) }];
}

const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Pass the downloaded score directory. See docs/petal-keys-music.md.');
if (process.argv.includes('--inspect')) {
  for (const file of fs.readdirSync(sourceDir, { recursive: true }).filter(file => file.endsWith('.mid'))) {
    console.log(file, JSON.stringify(readMidi(path.join(sourceDir, file)).map((track, i) => ({
      i, name: track.name, count: track.notes.length, first: track.notes.slice(0, 6),
    }))));
  }
}

const source = id => `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${id}`;
const pd = { license: 'Public domain', licenseUrl: 'https://www.mutopiaproject.org/legal.html' };
const schumann = { credit: 'Philippe Hézaine, © 2007 · Mutopia', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/' };
const manifest = [
  { id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven', bpm: 92, difficulty: 'Gentle', file: 'ode.mid', tracks: [1], start: 0, end: 32, sourceUrl: source(528), credit: 'Peter Chubb · Mutopia', ...pd },
  { id: 'gymnopedie', title: 'Gymnopédie No. 1', composer: 'Erik Satie', bpm: 80, difficulty: 'Gentle', file: 'gymnopedie_1.mid', tracks: [1], start: 13, end: 51, sourceUrl: source(37), credit: 'Evin Robertson · Mutopia', ...pd },
  { id: 'lullaby', title: 'Brahms’s Lullaby', composer: 'Johannes Brahms', bpm: 84, difficulty: 'Easy', file: 'Wiegenlied-mids/Wiegenlied.mid', tracks: [1], start: 5.5, end: 53.5, sourceUrl: source(1037), credit: 'Shogo Mori · Mutopia', ...pd },
  { id: 'melody', title: 'Melody, Op. 68 No. 1', composer: 'Robert Schumann', bpm: 92, difficulty: 'Easy', file: 'schumann-op68-01-melodie.mid', tracks: [1], start: 0, end: 32, sourceUrl: source(647), ...schumann },
  { id: 'canon', title: 'Canon in D', composer: 'Johann Pachelbel', bpm: 80, difficulty: 'Easy', file: 'Canon_per_3_Violini_e_Basso-mids/violin_one_part.mid', tracks: [1], start: 8, end: 40, sourceUrl: source(2047), credit: 'Michael Fischer v. Mollard, © 2015 · Mutopia', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  { id: 'minuet', title: 'Minuet in G', composer: 'Christian Petzold', bpm: 104, difficulty: 'Moderate', file: 'anna-magdalena-04.mid', tracks: [1], start: 0, end: 48, sourceUrl: source(75), credit: 'Allen Garvin · Mutopia (historically attributed to Bach)', ...pd },
  { id: 'nachtmusik', title: 'Eine kleine Nachtmusik', composer: 'Wolfgang Amadeus Mozart', bpm: 108, difficulty: 'Moderate', file: 'eine-kleine-nachtmusik-mvt1.mid', tracks: [1], start: 0, end: 40, sourceUrl: source(900), credit: 'Anonymous typesetter · Mutopia', ...pd },
  { id: 'mountain-king', title: 'In the Hall of the Mountain King', composer: 'Edvard Grieg', bpm: 112, difficulty: 'Moderate', file: 'Dans_l_antre_du_roi_de_la_montagne.mid', tracks: [1], start: 4, end: 68, transpose: 24, sourceUrl: source(1888), credit: 'Coyau · Mutopia', ...pd },
  { id: 'wild-rider', title: 'The Wild Rider', composer: 'Robert Schumann', bpm: 116, difficulty: 'Lively', file: 'wild-rider.mid', tracks: [1], start: 0, end: 48, sourceUrl: source(655), ...schumann },
  { id: 'prelude', title: 'Prelude in C Major, BWV 846', composer: 'Johann Sebastian Bach', bpm: 64, difficulty: 'Lively', file: 'wtk1-prelude1.mid', tracks: [1, 2], start: 0, end: 32, sourceUrl: source(5), credit: 'Tobias Erbsland, Shay Rojansky and Han-Wen Nienhuys · Mutopia', ...pd },
  { id: 'fur-elise', title: 'Für Elise', composer: 'Ludwig van Beethoven', bpm: 68, difficulty: 'Challenging', file: 'fur_Elise_WoO59.mid', tracks: [1], start: 0, end: 24.5, sourceUrl: source(931), credit: 'Stelios Samelis · Mutopia', ...pd },
  { id: 'turkish-march', title: 'Turkish March', composer: 'Wolfgang Amadeus Mozart', bpm: 88, difficulty: 'Challenging', file: 'KV331_3_RondoAllaTurca.mid', tracks: [1], start: 0, end: 33, sourceUrl: source(108), credit: 'Rune Zedeler and Chris Sawer · Mutopia', ...pd },
  { id: 'ballade-no-1', title: 'Ballade No. 1 in G Minor, Op. 23', composer: 'Frédéric Chopin', bpm: 104, difficulty: 'Lively', file: 'chopin-op23-ballade-1.mid', tracks: [1], start: 0, end: 148, sourceUrl: source(1959), credit: 'Javier Ruiz-Alma, © 2014 · Mutopia · opening and first theme', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'bumblebee', title: 'Flight of the Bumblebee', composer: 'Nikolai Rimsky-Korsakov', bpm: 144, difficulty: 'Final boss', file: 'bumblebee/score.xml', tracks: [0], start: 0, end: 202, minNoteSeconds: .1, sourceUrl: 'https://musetrainer.github.io/library/scores/Flight_of_the_Bumblebee.mxl', credit: 'MuseTrainer public-domain score library · Hummelflug · running melody across both hands; chords reduced', ...pd },
];

if (!process.argv.includes('--inspect')) {
  // Traditional tune; this is the complete familiar six-phrase melody.
  const twinklePhrases = ['60 60 67 67 69 69 67:2', '65 65 64 64 62 62 60:2', '67 67 65 65 64 64 62:2'];
  let beat = 0;
  const twinkle = [0, 1, 2, 2, 0, 1].flatMap(i => twinklePhrases[i].split(' ').map(token => {
    const [midi, duration = 1] = token.split(':').map(Number);
    const note = [beat, midi, duration]; beat += duration; return note;
  }));
  const songs = [{ id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', composer: 'Traditional French melody', bpm: 88, difficulty: 'Gentle',
    rank: 1, sourceUrl: 'https://www.mutopiaproject.org/ftp/MozartWA/KV265/guitar-duo-complete/guitar-duo-complete-a4.pdf', credit: 'Traditional melody · original Petal Keys chart', ...pd, notes: twinkle }];
  for (const entry of manifest) {
    const { file, tracks, start, end, minPitch = 0, transpose = 0, minNoteSeconds = .12, ...info } = entry;
    const midi = file.endsWith('.xml') ? readBumblebee(path.join(sourceDir, file)) : readMidi(path.join(sourceDir, file));
    const candidates = tracks.flatMap(index => midi[index].notes).filter(note => note.at >= start && note.at < end && note.midi >= minPitch
      // Tiny encoded grace notes make physically unplayable tiles; omit ornaments.
      && note.duration * 60 / entry.bpm >= minNoteSeconds)
      .sort((a, b) => a.at - b.at || b.midi - a.midi);
    const topLine = candidates.filter((note, index) => index === 0 || note.at !== candidates[index - 1].at);
    // Highest simultaneous pitch; remove accompaniment under sustained melody notes.
    const melody = [];
    for (const note of topLine) {
      const previous = melody.at(-1);
      if (previous && note.at < previous.at + previous.duration - .001 && note.midi <= previous.midi) continue;
      melody.push(note);
    }
    let notes = melody.map((note, index) => [
      note.at - start, note.midi + transpose,
      Math.min(note.duration, (melody[index + 1]?.at ?? end) - note.at, end - note.at),
    ]);
    if (entry.id === 'gymnopedie') {
      // Read from the top voice of the LilyPond score. Its long F# overlaps
      // identical accompaniment pitches, which MIDI alone cannot disambiguate.
      const pitches = [78, 81, 79, 78, 73, 71, 73, 74];
      notes = [...pitches.map((midi, at) => [at, midi, 1]), [8, 69, 3], [11, 66, 12],
        ...pitches.map((midi, at) => [24 + at, midi, 1]), [32, 69, 3], [35, 73, 3]];
    }
    if (notes.length < 12) throw new Error(`Excerpt too short: ${entry.id}`);
    songs.push({ ...info, rank: songs.length + 1, notes });
  }
  songs.push(...EXTRA_PETAL_SCORES);
  const order = ['twinkle', 'ode-to-joy', 'gymnopedie', 'lullaby', 'melody', 'canon', 'minuet',
    'waltz-a-minor', 'loves-sorrow', 'nachtmusik', 'mountain-king', 'wild-rider', 'prelude',
    'ballade-no-1', 'fur-elise', 'turkish-march', 'bumblebee'];
  songs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  songs.forEach((song, index) => { song.rank = index + 1; });
  const output = new URL('../src/petalSongData.json', import.meta.url);
  fs.writeFileSync(output, '[\n' + songs.map(song => '  ' + JSON.stringify(song)).join(',\n') + '\n]\n');
  console.log(songs.map(song => `${song.rank}. ${song.title}: ${song.notes.length} notes`).join('\n'));
}
