// Stone-on-wood click, synthesised once into a buffer rather than shipped as a
// sample. A hard knock is a burst of contact noise that rings a few short,
// inharmonic resonances: bright ones for the stone, low ones for the board.

// stone / wood: [frequency Hz, decay s, level] per resonance.
// noise: [level, decay s, smoothing 0..1 (lower is duller)].
// bounces: [time s, level] for the knock and any settling taps after it.
export const PRESETS = [
  { name: 'Current',
    stone: [[2380, 0.006, 0.5], [3910, 0.004, 0.32], [5630, 0.0025, 0.2]],
    wood: [[310, 0.016, 0.55], [560, 0.011, 0.4], [930, 0.007, 0.26]],
    noise: [0.9, 0.0012, 0.45], bounces: [[0, 0.36], [0.152, 0.1], [0.229, 0.035]] },
  { name: 'Soft knock',
    stone: [[1500, 0.004, 0.3], [2400, 0.0025, 0.15]],
    wood: [[260, 0.012, 0.6], [480, 0.008, 0.4]],
    noise: [0.6, 0.001, 0.25], bounces: [[0, 0.42], [0.152, 0.08]] },
  { name: 'Low thud',
    stone: [[1200, 0.003, 0.15]],
    wood: [[180, 0.012, 0.7], [340, 0.008, 0.45]],
    noise: [0.5, 0.0012, 0.15], bounces: [[0, 0.5]] },
  { name: 'Stone on thick board',
    stone: [[1900, 0.003, 0.35]],
    wood: [[420, 0.009, 0.55], [760, 0.006, 0.3]],
    noise: [0.7, 0.0008, 0.3], bounces: [[0, 0.42], [0.152, 0.07]] },
  { name: 'Muted tap',
    stone: [],
    wood: [[230, 0.008, 0.7], [410, 0.005, 0.3]],
    noise: [0.8, 0.0015, 0.1], bounces: [[0, 0.55]] },
  { name: 'Dry tick',
    stone: [[1700, 0.0025, 0.45], [2600, 0.0018, 0.2]],
    wood: [[380, 0.005, 0.35]],
    noise: [0.6, 0.0006, 0.3], bounces: [[0, 0.45]] },
];
const DEFAULT = 0;

let ctx = null;
const buffers = new Map();

function renderClick(rate, preset) {
  const length = Math.floor(rate * 0.3);
  const data = new Float32Array(length);
  const [noiseLevel, noiseDecay, smoothing] = preset.noise;
  for (const [start, gain] of preset.bounces) {
    const from = Math.floor(start * rate);
    let low = 0;
    for (let i = from; i < length; i++) {
      const t = (i - from) / rate;
      if (t > 0.12) break;
      // Contact noise, smoothed so it cracks rather than hisses.
      low += smoothing * ((Math.random() * 2 - 1) - low);
      let v = low * noiseLevel * Math.exp(-t / noiseDecay);
      for (const [f, decay, amp] of preset.stone) v += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay);
      for (const [f, decay, amp] of preset.wood) v += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay);
      // A few samples of attack avoid a digital tick at the very start.
      data[i] += gain * v * Math.min(1, t / 0.0004);
    }
  }
  return data;
}

export function playClick(delayMs = 150, presetIndex = DEFAULT) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    let buffer = buffers.get(presetIndex);
    if (!buffer) {
      buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
      buffer.getChannelData(0).set(renderClick(ctx.sampleRate, PRESETS[presetIndex]));
      buffers.set(presetIndex, buffer);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.93 + Math.random() * 0.14; // no two stones land quite alike
    src.connect(ctx.destination);
    src.start(ctx.currentTime + delayMs / 1000);
  } catch { /* no audio available */ }
}

export const _renderClick = renderClick; // for tests
