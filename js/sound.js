// Stone-on-wood click, synthesised once into a buffer rather than shipped as a
// sample. A hard knock is a burst of contact noise that rings a few short,
// inharmonic resonances: bright ones for the stone, low ones for the board.

// stone / wood: [frequency Hz, decay s, level] per resonance.
// noise: [level, decay s, smoothing 0..1 (lower is duller)].
// bounces: [time s, level] for the knock and the settling tap after it.
// Chosen by ear: a soft, low knock. Longer decays start to ring like a drum.
const KNOCK = {
  stone: [[1200, 0.004, 0.3], [1920, 0.0025, 0.15]],
  wood: [[210, 0.012, 0.6], [385, 0.008, 0.4]],
  noise: [0.6, 0.001, 0.2],
  bounces: [[0, 0.27], [0.152, 0.05]],
};

let ctx = null;
let click = null;

function renderClick(rate, preset = KNOCK) {
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

export function playClick(delayMs = 150) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (!click) {
      click = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
      click.getChannelData(0).set(renderClick(ctx.sampleRate));
    }
    const src = ctx.createBufferSource();
    src.buffer = click;
    src.playbackRate.value = 0.93 + Math.random() * 0.14; // no two stones land quite alike
    src.connect(ctx.destination);
    src.start(ctx.currentTime + delayMs / 1000);
  } catch { /* no audio available */ }
}

export const _renderClick = renderClick; // for tests
