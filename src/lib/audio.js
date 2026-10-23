/**
 * Âm báo nhỏ dùng cho đếm ngược chụp ảnh.
 * Không phát được thì bỏ qua — im lặng là hành vi chấp nhận được.
 */

let audioCtx = null;

export function beep(freq = 760, dur = 0.07) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* im lặng nếu không phát được âm */
  }
}

/**
 * Tiếng cơ máy ảnh: một tiếng "cạch" khô (nhiễu ngắn) kèm còi tụt.
 * Dùng khi ảnh được chụp — thủ công hoặc tự động.
 */
export function shutterClick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const t = audioCtx.currentTime;

    // Click cơ: một xung nhiễu cực ngắn, tự tắt dần.
    const len = Math.floor(audioCtx.sampleRate * 0.045);
    const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.32;
    noise.connect(noiseGain).connect(audioCtx.destination);
    noise.start(t);

    // Còi cơ: xuống tần số nhanh, tắt ngay.
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gain).connect(audioCtx.destination);
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    /* im lặng nếu không phát được âm */
  }
}
