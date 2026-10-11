// ── i68: Web Audio sound system ───────────────────────────────────────────

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone(freq, type, duration, gainVal = 0.18, delay = 0) {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch (e) {}
}

export function sfx(name) {
  switch (name) {
    case 'correct':
      playTone(523, 'sine', 0.12, 0.15);
      playTone(659, 'sine', 0.12, 0.15, 0.12);
      playTone(784, 'sine', 0.18, 0.15, 0.24);
      break;
    case 'wrong':
      playTone(220, 'sawtooth', 0.18, 0.12);
      playTone(180, 'sawtooth', 0.22, 0.10, 0.15);
      break;
    case 'conquest':
      playTone(440, 'square', 0.08, 0.10);
      playTone(554, 'square', 0.08, 0.10, 0.09);
      playTone(659, 'sine',   0.14, 0.12, 0.18);
      break;
    case 'lose_province':
      playTone(330, 'sawtooth', 0.14, 0.12);
      playTone(262, 'sawtooth', 0.18, 0.10, 0.15);
      break;
    case 'turn':
      playTone(392, 'sine', 0.1, 0.08);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'sine', 0.25, 0.18, i * 0.13));
      break;
    case 'lose':
      [330, 294, 262, 220].forEach((f, i) => playTone(f, 'sawtooth', 0.25, 0.12, i * 0.15));
      break;
    case 'build':
      playTone(440, 'sine', 0.08, 0.10);
      playTone(550, 'sine', 0.12, 0.12, 0.09);
      break;
  }
}
