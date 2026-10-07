# Petal Keys songbook

Petal Keys plays bundled score data through a generated Web Audio piano. No audio downloads, APIs, accounts, tracking, or new runtime dependencies are needed. Scores and game state remain in the browser.

## Playing

- Press D, F, J, K, click the four piano keys, or tap their lanes on the board.
- Play a flower when its centre reaches the stitched line. A ribbon means hold until its end reaches that line; releasing slightly before the end is allowed.
- A tap earns 10 points, or 20 for precise timing. A completed ribbon adds 20 points. Failed holds never receive the completion bonus.
- Sustained notes and alternating shorter notes become ribbons, provided their written length is at least 0.48 seconds. Every ribbon ends 0.12 seconds before the next onset, giving time to lift and press again. Fast passages stay as taps. The songbook contains 184 holds; Twinkle now has 24 instead of six.
- During a hold, the flower's ring and the key's progress bar fill together. The key changes from “Hold…” to “Release” at completion. Inputs are judged using their arrival time between animation frames. A stall longer than 350 ms pauses the game.
- Play mode gives three chances. Practice runs at 75% tempo and continues through mistakes; it does not set the session best.
- P/Escape pauses. Leaving the game or browser also pauses it. A paused ribbon waits for its key to be held again before the score resumes.
- Assistive activation of a key toggles a hold; activate again to release. Physical Space/Enter on a focused key work as press/release.

## Difficulty and arrangements

These are **short, single-melody game arrangements**, not full performances or piano-grade rankings. The traditional Twinkle melody is complete. The other entries are excerpts, with accompaniment and simultaneous chords removed, selected tempi, and four-lane mapping. Pitches retain the melody; Grieg's low opening is shifted up two octaves. The importer uses the highest simultaneous pitch and removes lower accompaniment underneath held notes. Grace notes shorter than 120 ms are omitted for playable timing. Satie's top voice is transcribed from the LilyPond score because overlapping identical pitches in the MIDI are ambiguous. Waltz in A Minor and Love's Sorrow are hand-checked melody reductions in `scripts/petal-extra-scores.mjs`.

| Order | Piece | Composer | Game level |
| --- | --- | --- | --- |
| 1 | Twinkle, Twinkle, Little Star | Traditional French melody | Gentle |
| 2 | Ode to Joy | Beethoven | Gentle |
| 3 | Gymnopédie No. 1 | Satie | Gentle |
| 4 | Brahms’s Lullaby | Brahms | Easy |
| 5 | Melody, Op. 68 No. 1 | Schumann | Easy |
| 6 | Canon in D | Pachelbel | Easy |
| 7 | Minuet in G | Petzold | Moderate |
| 8 | Waltz in A Minor, B. 150 | Chopin | Moderate |
| 9 | Love's Sorrow (Liebesleid) | Kreisler, arr. Rachmaninoff | Moderate |
| 10 | Eine kleine Nachtmusik | Mozart | Moderate |
| 11 | In the Hall of the Mountain King | Grieg | Moderate |
| 12 | The Wild Rider | Schumann | Lively |
| 13 | Prelude in C Major, BWV 846 | Bach | Lively |
| 14 | Ballade No. 1 in G Minor, Op. 23 | Chopin | Lively |
| 15 | Für Elise | Beethoven | Challenging |
| 16 | Turkish March | Mozart | Challenging |
| 17 | Flight of the Bumblebee | Rimsky-Korsakov | Final boss |

Love's Sorrow uses 96 BPM (up from 88). The final boss uses 144 BPM and follows the complete 101-bar source arrangement as a single running melody: 774 tiles over approximately 84 seconds, with sixteenth-note passages reaching 9.6 notes per second. Very fast repeated lanes alternate fingers without changing the played pitches. Slightly slimmer tiles and faster scrolling keep the dense runs legible. Practice remains at 75% tempo (108 BPM) with unlimited chances.

## Sources and attribution

Every song includes a source link, typesetter credit, and license in `src/petalSongData.json`, also displayed in the game's **About these arrangements** disclosure. Compositions are historical; the source editions have their own licenses:

- Public-domain Mutopia editions: [Ode to Joy](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528), [Gymnopédie No. 1](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37), [Brahms’s Lullaby](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1037), [Minuet in G](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75), [Eine kleine Nachtmusik](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=900), [Mountain King](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888), [Prelude in C](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5), [Für Elise](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931), [Turkish March](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108).
- [Canon](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047): Michael Fischer v. Mollard, © 2015, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The derived Canon note chart retains that license.
- [Melody](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=647) and [The Wild Rider](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=655): Philippe Hézaine, © 2007, [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/). The two derived Schumann note charts in `petalSongData.json` are distributed under that same license. This applies to those musical arrangements, not unrelated application code.
- Twinkle: original encoding of the traditional French tune. Mozart wrote variations on it; he did not compose the tune. No recording or modern arrangement is copied.
- Minuet in G, BWV Anh. 114, is credited to Christian Petzold, although the archive uses its older Bach attribution.
- [Waltz in A Minor](https://musetrainer.github.io/library/scores/Waltz_in_A_MinorChopin.mxl): MuseTrainer's public-domain score library, right-hand opening through the E-major cadence. The note reduction is encoded locally; no recording is copied.
- [Ballade No. 1](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959): Javier Ruiz-Alma, © 2014, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), based on Klindworth/Bote & Bock circa 1880. The derived Ballade chart retains CC BY-SA 4.0. Excerpt: first 148 quarter-note beats, simplified into one line at 104 BPM.
- [Love's Sorrow](https://imslp.org/wiki/3_Old_Viennese_Dances_(Kreisler,_Fritz)#For_Piano_(Rachmaninoff)): Kreisler/Rachmaninoff, Charles Foley first edition, 1923 (IMSLP #293942). Opening 14 bars, tied melody notes merged, grace notes and accompaniment omitted. This historical edition is public domain in the US; IMSLP flags the underlying Kreisler work as not yet public domain in the EU. The interface preserves that territorial distinction in the source credit.
- [Flight of the Bumblebee](https://musetrainer.github.io/library/scores/Flight_of_the_Bumblebee.mxl): [MuseTrainer's public-domain MusicXML library](https://github.com/musetrainer/library), titled “Hummelflug” in the score. Running melody selected across both hands; at simultaneous onsets the shortest note is preferred, then the highest pitch, reducing chords to one tile. No audio recording is used.

### Requested piece awaiting a usable source

“Spring Waltz” was confirmed to mean **Mariage d'Amour** by Paul de Senneville, not a Chopin waltz. It is not bundled: a user-provided score/MIDI with permission to adapt and publish it is needed. Do not substitute an unrelated tune under that title or import an unauthorized online transcription.

## Rebuilding the data

`scripts/import-petal-scores.mjs` is an offline development utility. Download the MIDI files linked by the source pages (including `chopin-op23-ballade-1.mid`), unzip the Brahms and Canon downloads, and place them in one directory. The exact expected names and excerpt beat ranges are in its manifest (`wild-rider.mid` is the renamed Op. 68 No. 8 MIDI). The two checked melody reductions are imported from `scripts/petal-extra-scores.mjs`.

For Bumblebee, download the linked `.mxl` (a ZIP archive), extract it to `bumblebee/` inside that source directory, and retain `bumblebee/score.xml`. The importer reads its notes, chords, rests, divisions, voices, and ties without external dependencies. Its deliberate sixteenth notes use a 100 ms minimum instead of the other charts' 120 ms ornament filter.

Run `node scripts/import-petal-scores.mjs <score-directory>` to regenerate `src/petalSongData.json`. The `--inspect` flag prints track names and initial notes without changing project files. The website's regular build never downloads music or runs the importer.

`npm run test:arcade` covers hold timing, release tolerance, pause/re-hold, practice, failure, nearest-note judgement, playable spacing, source openings, boss ordering/density, rapid lane alternation, and perfect completion of all seventeen charts.
