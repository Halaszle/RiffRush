const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteToMidi(note) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note);

  if (!match) {
    throw new Error(`Unsupported note format: ${note}`);
  }

  const [, pitchClass, octaveRaw] = match;
  const octave = Number(octaveRaw);
  const pitchIndex = noteNames.indexOf(pitchClass);

  if (pitchIndex === -1) {
    throw new Error(`Unsupported note name: ${note}`);
  }

  return pitchIndex + (octave + 1) * 12;
}

export function noteToFrequency(note) {
  const midi = noteToMidi(note);
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
}

export function frequencyToNote(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const midi = Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
  const name = noteNames[(midi + 1200) % 12];
  const octave = Math.floor(midi / 12) - 1;

  return `${name}${octave}`;
}
