import { readFileSync } from 'fs';
import path from 'path';
import {
  DEFAULT_BARS,
  DEFAULT_BPM,
  BEATS_PER_BAR,
  DEFAULT_DURATION_BEATS,
  DEFAULT_VELOCITY,
  MAX_BARS,
} from './constants.js';
import {
  normalizeSymbol,
  parseNumber,
  noteSymbolToMidi,
  chordToMidis,
  velocityFromAmp,
  clampDuration,
  buildScaleNotes,
} from './utils.js';
import { mapSampleToDrum } from './constants.js';

function extractGlobalBpm(code) {
  const match = code.match(/use_bpm\s+([0-9.]+)/);
  return match ? parseNumber(match[1]) || DEFAULT_BPM : DEFAULT_BPM;
}

function splitLiveLoops(code) {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const loops = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const liveMatch = line.match(/^live_loop\s+:([\w\d_]+)\s+do/);
    if (!liveMatch) {
      i += 1;
      continue;
    }
    const name = liveMatch[1];
    const body = [];
    let depth = 1;
    i += 1;
    for (; i < lines.length; i += 1) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (/\bdo\b/.test(trimmed)) depth += 1;
      if (/^end\b/.test(trimmed)) {
        depth -= 1;
        if (depth === 0) break;
      }
      if (depth > 0) body.push(raw);
    }
    loops.push({ name, body });
    i += 1;
  }
  return loops;
}

function collectDoEndBlock(lines, startIndex) {
  const body = [];
  let depth = 1;
  let i = startIndex;
  for (; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/\bdo\b/.test(trimmed)) depth += 1;
    if (/^end\b/.test(trimmed)) {
      depth -= 1;
      if (depth === 0) break;
    }
    if (depth > 0) body.push(lines[i]);
  }
  return { body, nextIndex: i + 1 };
}

function parseHashArgs(argStr) {
  const opts = {};
  if (!argStr) return opts;
  const regex = /([a-zA-Z_][\w]*):\s*([^,]+)/g;
  let match;
  while ((match = regex.exec(argStr))) {
    const key = match[1];
    const raw = match[2].trim();
    const num = parseNumber(raw);
    opts[key] = Number.isFinite(num) ? num : raw.replace(/['"]/g, '');
  }
  return opts;
}

function splitTopLevel(listStr) {
  const items = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < listStr.length; i += 1) {
    const ch = listStr[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function parseListToValues(listStr) {
  return splitTopLevel(listStr)
    .map((token) => {
      const chordMatch = token.match(/^chord\(([^)]+)\)$/);
      if (chordMatch) {
        const args = chordMatch[1].split(',').map((s) => s.trim());
        const tonic = args[0];
        const quality = args[1] || 'major';
        return chordToMidis(tonic, quality);
      }
      const num = parseNumber(token);
      if (Number.isFinite(num)) return num;
      const midi = noteSymbolToMidi(token);
      return midi !== null ? midi : null;
    })
    .filter((v) => v !== null);
}

function nextTickValue(name, context) {
  if (!context.bindings || !Array.isArray(context.bindings[name]) || context.bindings[name].length === 0) return null;
  context.tickIndices = context.tickIndices || {};
  const arr = context.bindings[name];
  const idx = context.tickIndices[name] ?? 0;
  const val = arr[idx % arr.length];
  context.tickIndices[name] = (idx + 1) % arr.length;
  return val;
}

function parsePlay(line, loopName, context) {
  // chord
  const chordMatch = line.match(/chord\(([^)]+)\)/);
  if (chordMatch) {
    const args = chordMatch[1].split(',').map((s) => s.trim());
    const tonic = args[0];
    const quality = args[1] || 'major';
    const notes = chordToMidis(tonic, quality);
    const opts = parseHashArgs(line.slice(line.indexOf('chord(') + chordMatch[0].length));
    return buildEvent(notes, loopName, context, opts);
  }
  const playMatch = line.match(/play\s+([:\w#.]+)\s*(.*)/);
  if (!playMatch) return null;
  const target = playMatch[1];
  if (target === 'notes.choose') {
    const scaleNotes = context.scaleNotes && context.scaleNotes.length > 0 ? context.scaleNotes : null;
    if (scaleNotes) {
      const idx = Math.floor(Math.random() * scaleNotes.length);
      const notes = [scaleNotes[idx]];
      const opts = parseHashArgs(playMatch[2]);
      return buildEvent(notes, loopName, context, opts);
    }
    const fallback = context.scaleRoot ? noteSymbolToMidi(context.scaleRoot) : noteSymbolToMidi(':c2');
    const notes = fallback !== null ? [fallback] : [48];
    const opts = parseHashArgs(playMatch[2]);
    return buildEvent(notes, loopName, context, opts);
  }
  const notes = [];
  let resolved = null;
  if (target.endsWith('.tick')) {
    const base = target.replace(/\.tick$/, '');
    resolved = nextTickValue(base, context);
  } else if (context.bindings && context.bindings[target] !== undefined) {
    resolved = context.bindings[target];
  } else {
    resolved = noteSymbolToMidi(target);
  }
  if (Array.isArray(resolved)) {
    const flattened = resolved.flat ? resolved.flat() : resolved;
    flattened.forEach((m) => {
      if (m !== null) notes.push(m);
    });
  } else if (resolved !== null) {
    notes.push(resolved);
  }
  const opts = parseHashArgs(playMatch[2]);
  return buildEvent(notes, loopName, context, opts);
}

function parseSample(line, loopName, context) {
  const match = line.match(/sample\s+([:\w][\w_]*)\s*(.*)/);
  if (!match) return null;
  const sampleName = normalizeSymbol(match[1]);
  const opts = parseHashArgs(match[2]);
  const drum = mapSampleToDrum(sampleName);
  const notes = drum ? [drum.midi] : [60]; // fallback middle C for non-drums
  const baseDuration =
    clampDuration(opts.release ?? DEFAULT_DURATION_BEATS) ?? DEFAULT_DURATION_BEATS;
  const minDrumDuration = drum
    ? {
        hat_closed: 0.2,
        hat_open: 0.5,
        cymbal: 0.5,
        ride: 0.5,
        snare: 0.2,
        clap: 0.2,
      }[drum.id] ?? 0.1
    : 0;
  const durationBeats = Math.max(baseDuration, minDrumDuration);
  const durationSec = durationBeats * (60 / context.bpm);
  return {
    type: 'note',
    notes,
    instrumentId: drum ? `drum:${drum.id}` : `sample:${sampleName}`,
    isPercussion: Boolean(drum),
    startBeat: context.time,
    durationBeats,
    startSec: context.timeSec,
    durationSec: durationBeats ? durationSec : null,
    velocity: velocityFromAmp(opts.amp) ?? context.defaults.velocity,
    loopName,
    bpm: context.bpm,
  };
}

function buildEvent(notes, loopName, context, opts) {
  if (!notes || notes.length === 0) return null;
  const duration =
    clampDuration(opts.release ?? opts.sustain ?? context.defaults.duration ?? DEFAULT_DURATION_BEATS) ??
    DEFAULT_DURATION_BEATS;
  return {
    type: 'note',
    notes,
    instrumentId: context.synth ? `synth:${context.synth}` : 'synth:default',
    isPercussion: false,
    startBeat: context.time,
    startSec: context.timeSec,
    durationBeats: duration,
    durationSec: duration * (60 / context.bpm),
    velocity: velocityFromAmp(opts.amp) ?? context.defaults.velocity,
    loopName,
    bpm: context.bpm,
  };
}

function parseBlock(lines, loopName, baseContext, warnings) {
  const events = [];
  let timeBeats = 0;
  let timeSec = 0;
  const offsetBeats = baseContext.offsetBeats ?? 0;
  const offsetSec = baseContext.offsetSec ?? 0;
  const context = {
    bpm: baseContext.bpm,
    synth: baseContext.synth,
    defaults: { velocity: DEFAULT_VELOCITY, duration: DEFAULT_DURATION_BEATS, ...baseContext.defaults },
    bindings: baseContext.bindings ? { ...baseContext.bindings } : {},
    tickIndices: baseContext.tickIndices ? { ...baseContext.tickIndices } : {},
    time: timeBeats,
    timeSec,
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      i += 1;
      continue;
    }

    const bpmMatch = line.match(/^use_bpm\s+([0-9.]+)/);
    if (bpmMatch) {
      const bpmVal = parseNumber(bpmMatch[1]);
      if (bpmVal) context.bpm = bpmVal;
      i += 1;
      continue;
    }

    const synthMatch = line.match(/^use_synth\s+:?([\w\d_]+)/);
    if (synthMatch) {
      context.synth = synthMatch[1];
      i += 1;
      continue;
    }

    const defaultsMatch = line.match(/^use_synth_defaults\s+(.*)/);
    if (defaultsMatch) {
      const opts = parseHashArgs(defaultsMatch[1]);
      if (opts.amp !== undefined) context.defaults.velocity = velocityFromAmp(opts.amp);
      if (opts.release !== undefined) context.defaults.duration = clampDuration(opts.release);
      i += 1;
      continue;
    }

    const scaleAssign = line.match(/notes\s*=\s*\(scale\s+([:\w#]+)\s*,\s*([:\w]+)(?:,\s*num_octaves:\s*([0-9]+))?/);
    if (scaleAssign) {
      context.scaleRoot = scaleAssign[1];
      context.scaleNotes = buildScaleNotes(scaleAssign[1], scaleAssign[2], Number(scaleAssign[3]) || 1);
      context.bindings = context.bindings || {};
      context.bindings.notes = context.scaleNotes;
      i += 1;
      continue;
    }

    const ringAssign = line.match(/^([a-zA-Z_][\w]*)\s*=\s*\(ring\s+(.*)/);
    if (ringAssign) {
      const key = ringAssign[1];
      let remainder = ringAssign[2];
      while (!remainder.includes(')') && i + 1 < lines.length) {
        i += 1;
        remainder += ` ${lines[i].trim()}`;
      }
      const cleaned = remainder.replace(/\)\s*$/, '');
      const vals = parseListToValues(cleaned);
      context.bindings = context.bindings || {};
      context.bindings[key] = vals;
      i += 1;
      continue;
    }

    const arrayAssign = line.match(/^([a-zA-Z_][\w]*)\s*=\s*\[(.*)/);
    if (arrayAssign) {
      const key = arrayAssign[1];
      let remainder = arrayAssign[2];
      while (!remainder.includes(']') && i + 1 < lines.length) {
        i += 1;
        remainder += ` ${lines[i].trim()}`;
      }
      const cleaned = remainder.replace(/\]\s*$/, '');
      const vals = parseListToValues(cleaned);
      context.bindings = context.bindings || {};
      context.bindings[key] = vals;
      i += 1;
      continue;
    }

    const timesMatch = line.match(/^(\d+)\.times\s+do/);
    if (timesMatch) {
      const repeat = Number(timesMatch[1]);
      const { body, nextIndex } = collectDoEndBlock(lines, i + 1);
      for (let r = 0; r < repeat; r += 1) {
        const inner = parseBlock(
          body,
          loopName,
          {
            ...context,
            offsetBeats: offsetBeats + timeBeats,
            offsetSec: offsetSec + timeSec,
            tickIndices: context.tickIndices,
            bindings: context.bindings,
          },
          warnings
        );
        inner.events.forEach((evt) => events.push(evt));
        timeBeats += inner.lengthBeats;
        timeSec += inner.lengthSec;
        context.tickIndices = inner.tickIndices;
        context.bindings = inner.bindings;
      }
      context.time = timeBeats;
      context.timeSec = timeSec;
      i = nextIndex;
      continue;
    }

    const sleepMatch = line.match(/^sleep\s+([0-9.]+)/);
    if (sleepMatch) {
      const duration = parseNumber(sleepMatch[1]) || 0;
      timeBeats += duration;
      timeSec += duration * (60 / context.bpm);
      context.time = timeBeats;
      context.timeSec = timeSec;
      i += 1;
      continue;
    }

    const withBpmMatch = line.match(/^with_bpm\s+([0-9.]+)\s+do/);
    if (withBpmMatch) {
      const childBpm = parseNumber(withBpmMatch[1]) || context.bpm;
      const { body, nextIndex } = collectDoEndBlock(lines, i + 1);
      const inner = parseBlock(
        body,
        loopName,
        {
          ...context,
          bpm: childBpm,
          offsetBeats: 0,
          offsetSec: 0,
          tickIndices: context.tickIndices,
          bindings: context.bindings,
        },
        warnings
      );
      inner.events.forEach((evt) =>
        events.push({
          ...evt,
          startBeat: evt.startBeat + offsetBeats + timeBeats,
          startSec: evt.startSec + offsetSec + timeSec,
        })
      );
      timeBeats += inner.lengthBeats;
      timeSec += inner.lengthSec;
      context.time = timeBeats;
      context.timeSec = timeSec;
      context.tickIndices = inner.tickIndices;
      context.bindings = inner.bindings;
      i = nextIndex;
      continue;
    }

    const oneInMatch = line.match(/^if\s+one_in\((\d+)\)/);
    if (oneInMatch) {
      const threshold = Number(oneInMatch[1]) || 2;
      const trigger = Math.floor(Math.random() * threshold) === 0;
      const { body, nextIndex } = collectDoEndBlock(lines, i + 1);
      if (trigger) {
        const inner = parseBlock(
          body,
          loopName,
          {
            ...context,
            offsetBeats: offsetBeats + timeBeats,
            offsetSec: offsetSec + timeSec,
            tickIndices: context.tickIndices,
            bindings: context.bindings,
          },
          warnings
        );
        inner.events.forEach((evt) => events.push(evt));
        timeBeats += inner.lengthBeats;
        timeSec += inner.lengthSec;
        context.time = timeBeats;
        context.timeSec = timeSec;
        context.tickIndices = inner.tickIndices;
        context.bindings = inner.bindings;
      }
      i = nextIndex;
      continue;
    }

    const rrandMatch = line.match(/^([a-zA-Z_][\w]*)\s*=\s*rrand\(([^,]+),\s*([^)]+)\)/);
    if (rrandMatch) {
      const key = rrandMatch[1];
      const low = parseNumber(rrandMatch[2]) ?? 0;
      const high = parseNumber(rrandMatch[3]) ?? low;
      const val = Math.random() * (high - low) + low;
      context.bindings = context.bindings || {};
      context.bindings[key] = val;
      i += 1;
      continue;
    }

    const tickAssign = line.match(/^([a-zA-Z_][\w]*)\s*=\s*([a-zA-Z_][\w]*)\.tick/);
    if (tickAssign) {
      const target = tickAssign[1];
      const source = tickAssign[2];
      const val = nextTickValue(source, context);
      if (val !== null) {
        context.bindings = context.bindings || {};
        context.bindings[target] = val;
      }
      i += 1;
      continue;
    }

    const playEvent = parsePlay(line, loopName, context);
    if (playEvent) {
      events.push({
        ...playEvent,
        startBeat: playEvent.startBeat + offsetBeats,
        startSec: playEvent.startSec + offsetSec,
      });
      i += 1;
      continue;
    }

    const sampleEvent = parseSample(line, loopName, context);
    if (sampleEvent) {
      events.push({
        ...sampleEvent,
        startBeat: sampleEvent.startBeat + offsetBeats,
        startSec: sampleEvent.startSec + offsetSec,
      });
      i += 1;
      continue;
    }

    // Unsupported
    warnings.push(`Skipped line in ${loopName}: "${line}"`);
    i += 1;
  }

  const lastEventEnd = events.reduce(
    (max, evt) => Math.max(max, evt.startBeat + (evt.durationBeats || 0)),
    0
  );
  const lengthBeats = Math.max(timeBeats, lastEventEnd - offsetBeats);
  const lastEventEndSec = events.reduce(
    (max, evt) => Math.max(max, evt.startSec + (evt.durationSec || 0)),
    0
  );
  const lengthSec = Math.max(timeSec, lastEventEndSec - offsetSec);
  return {
    events,
    lengthBeats,
    lengthSec,
    baseTime: timeBeats,
    baseTimeSec: timeSec,
    tickIndices: context.tickIndices,
    bindings: context.bindings,
  };
}

export function parseSonicPiFile(filePath, options = {}) {
  const absolute = path.resolve(filePath);
  const code = readFileSync(absolute, 'utf8');
  return parseSonicPiCode(code, options);
}

export function parseSonicPiCode(code, options = {}) {
  const warnings = [];
  const bars = Math.min(options.bars || DEFAULT_BARS, MAX_BARS);
  const targetBeats = bars * BEATS_PER_BAR;
  const globalBpm = extractGlobalBpm(code);
  const baseBpm = options.bpmOverride || globalBpm || DEFAULT_BPM;
  const targetSeconds = targetBeats * (60 / baseBpm);
  const loops = splitLiveLoops(code);
  const events = [];

  if (loops.length === 0) {
    const lines = code.replace(/\r\n/g, '\n').split('\n');
    const parsed = parseBlock(
      lines,
      'main',
      { bpm: globalBpm, synth: null, defaults: {}, offsetBeats: 0, offsetSec: 0 },
      warnings
    );
    appendLoopEvents(events, parsed, 'main', targetBeats, targetSeconds);
  } else {
    for (const loop of loops) {
      const parsed = parseBlock(
        loop.body,
        loop.name,
        { bpm: globalBpm, synth: null, defaults: {}, offsetBeats: 0, offsetSec: 0 },
        warnings
      );
      appendLoopEvents(events, parsed, loop.name, targetBeats, targetSeconds);
    }
  }

  return {
    bpm: globalBpm,
    events: events.filter((evt) => evt.startSec < targetSeconds),
    warnings,
    targetBeats,
    targetSeconds,
  };
}

function appendLoopEvents(container, parsed, loopName, targetBeats, targetSeconds) {
  const span = parsed.lengthBeats || BEATS_PER_BAR;
  const spanSec = parsed.lengthSec || (span * 60) / DEFAULT_BPM;
  const safeSpan = span > 0 ? span : BEATS_PER_BAR;
  const safeSpanSec = spanSec > 0 ? spanSec : (BEATS_PER_BAR * 60) / DEFAULT_BPM;
  const iterations = Math.ceil(targetSeconds / safeSpanSec);
  for (let i = 0; i < iterations; i += 1) {
    const offsetBeats = i * safeSpan;
    const offsetSec = i * safeSpanSec;
    parsed.events.forEach((evt) => {
      const startBeat = evt.startBeat + offsetBeats;
      const startSec = evt.startSec + offsetSec;
      if (startSec >= targetSeconds) return;
      container.push({ ...evt, startBeat, startSec });
    });
  }
}
