let audioCtx: AudioContext | null = null;

export function playChime() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // In some browsers, AudioContext is suspended until user interaction
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Use a sine wave for a pure, bell-like tone
    osc.type = 'sine';
    
    // Base frequency (C5)
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 

    // Create a gentle envelope for a chime sound
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05); // quick soft attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5); // long gentle decay

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 3);
  } catch (err) {
    console.warn("Audio API not supported or failed to play chime", err);
  }
}
