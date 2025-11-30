const NOTE_BASE = {
  c: 0,
  cs: 1,
  df: 1,
  d: 2,
  ds: 3,
  ef: 3,
  e: 4,
  f: 5,
  fs: 6,
  gf: 6,
  g: 7,
  gs: 8,
  af: 8,
  a: 9,
  as: 10,
  bf: 10,
  b: 11,
};

const CHORD_INTERVALS = {
  major: [0, 4, 7],
  m: [0, 3, 7],
  minor: [0, 3, 7],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  dom7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  '11': [0, 4, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
};

export function normalizeSymbol(input) {
  if (!input) return '';
  return input.replace(/^:/, '').trim();
}

export function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function noteSymbolToMidi(sym, defaultOctave = 4) {
  if (!sym) return null;
  const clean = normalizeSymbol(sym).toLowerCase();
  const match = clean.match(/^([a-g])(?:(#|s|sh|sharp|b|fl|flat))?(\d+)?$/);
  if (!match) return null;
  const letter = match[1];
  const accidentalRaw = match[2] || '';
  const octave = match[3] ? Number(match[3]) : defaultOctave;
  const accidental =
    accidentalRaw === '#' || accidentalRaw === 's' || accidentalRaw === 'sh' || accidentalRaw === 'sharp'
      ? 's'
      : accidentalRaw === 'b' || accidentalRaw === 'fl' || accidentalRaw === 'flat'
      ? 'f'
      : '';
  const key = accidental ? `${letter}${accidental}` : letter;
  const semitone = NOTE_BASE[key];
  if (semitone === undefined) return null;
  return 12 * (octave + 1) + semitone;
}

export function chordToMidis(rootSym, quality) {
  const root = noteSymbolToMidi(rootSym);
  if (root === null) return [];
  const q = normalizeSymbol((quality || 'major').replace(/['"]+/g, ''));
  const intervals = CHORD_INTERVALS[q] || CHORD_INTERVALS.major;
  return intervals.map((i) => root + i);
}

export function velocityFromAmp(amp) {
  if (amp === undefined || amp === null) return null;
  const num = typeof amp === 'number' ? amp : parseFloat(amp);
  if (!Number.isFinite(num)) return null;
  const v = Math.max(0, Math.min(num, 2)); // clamp mildly
  return Math.max(0.05, Math.min(1, v / 2 + 0.5));
}

export function clampDuration(duration, min = 0.05, max = 16) {
  if (!Number.isFinite(duration)) return null;
  return Math.min(Math.max(duration, min), max);
}

const SCALE_INTERVALS = {
  minor_pentatonic: [0, 3, 5, 7, 10],
  major_pentatonic: [0, 2, 4, 7, 9],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

export function buildScaleNotes(rootSym, mode = 'minor_pentatonic', octaves = 1) {
  const root = noteSymbolToMidi(rootSym);
  if (root === null) return [];
  const normalized = normalizeSymbol(mode);
  const intervals = SCALE_INTERVALS[normalized] || SCALE_INTERVALS.minor_pentatonic;
  const notes = [];
  for (let o = 0; o < Math.max(1, octaves); o += 1) {
    const base = root + o * 12;
    intervals.forEach((i) => notes.push(base + i));
  }
  return notes;
}
