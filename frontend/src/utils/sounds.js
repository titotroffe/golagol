const getAudioCtx = () => { if (!window.audioCtx) { window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } return window.audioCtx; };

export function playWhistle() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(2500, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(2800, ctx.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.4);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 60;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start();
  lfo.stop(ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
  gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

export function playGoal() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const freqs = [250, 300, 350];
  freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime + 0.6);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  });
}

export function playPop() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}
