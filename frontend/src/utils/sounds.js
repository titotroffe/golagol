export const getAudioCtx = () => { 
  if (!window.audioCtx) { 
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
  } 
  return window.audioCtx; 
};

export function initAudio() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

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

  // Fanfarria triunfal: C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const startTime = ctx.currentTime;
  
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'triangle'; // Más suave que el sawtooth
    osc.frequency.value = freq;
    
    const noteStart = startTime + (index * 0.12);
    const isLast = index === notes.length - 1;
    const duration = isLast ? 1.2 : 0.12; // La última nota se mantiene
    
    gainNode.gain.setValueAtTime(0, noteStart);
    gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + duration);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(noteStart);
    osc.stop(noteStart + duration + 0.1);
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
