// Stone-on-wood click, synthesised once into a buffer rather than shipped as a
// sample. A hard knock is a burst of contact noise that rings a few short,
// inharmonic resonances: bright ones for the stone, low ones for the board.

let ctx = null;
let click = null;

const STONE = [[2380, 0.011, 0.5], [3910, 0.007, 0.32], [5630, 0.004, 0.2]];
const WOOD = [[290, 0.05, 0.6], [540, 0.032, 0.4], [910, 0.02, 0.26]];

function renderClick(rate) {
  const length = Math.floor(rate * 0.3);
  const data = new Float32Array(length);
  const knock = (start, gain) => {
    const from = Math.floor(start * rate);
    let low = 0;
    for (let i = from; i < length; i++) {
      const t = (i - from) / rate;
      // Contact noise, lightly smoothed so it cracks rather than hisses.
      low += 0.45 * ((Math.random() * 2 - 1) - low);
      let v = low * 0.9 * Math.exp(-t / 0.0012);
      for (const [f, decay, amp] of STONE) v += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay);
      for (const [f, decay, amp] of WOOD) v += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay);
      // A few samples of attack avoid a digital tick at the very start.
      data[i] += gain * v * Math.min(1, t / 0.0004);
    }
  };
  knock(0, 0.5);
  knock(0.152, 0.13); // the stone settles with two smaller bounces,
  knock(0.229, 0.045); // timed to the drop animation
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
