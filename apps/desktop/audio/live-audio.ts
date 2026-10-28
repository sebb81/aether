// Private audio renderer: no AETHER data, secret, network client or transcript.
interface AudioCommand { command: string; microphone?: string | null; volume?: number; bufferMs?: number; pcm?: Uint8Array }
const bridge = (window as unknown as { liveAudio: { send(value: object): void; listen(callback: (value: AudioCommand) => void): void } }).liveAudio;
let capture: AudioContext | null = null, playback: AudioContext | null = null, stream: MediaStream | null = null;
interface PlaybackNode extends AudioBufferSourceNode { envelope: GainNode; startTime: number; endTime: number; attackEnd: number; releaseStart: number; releaseCancelled: boolean }
const OUTPUT_RATE = 24000, EDGE_FADE_SECONDS = .005;
let nodes = new Set<PlaybackNode>(), tail: PlaybackNode | null = null, next = 0, volume = 1, bufferSeconds = .18, playing = false, level = 0;
let timer: ReturnType<typeof setInterval> | undefined, starting = false, generation = 0;
const metadata = { capture: null as { sink: 'none'; monitorGain: number; sampleRate: number } | null, scheduled: [] as { received: number; start: number; end: number }[], transitions: [] as { at: number; playing: boolean }[] };
Object.defineProperty(window, 'liveAudioMetadata', { get: () => structuredClone(metadata) });
function stop() { generation++;for (const node of nodes) { try { node.stop(); } catch { /* Already ended. */ } }nodes.clear();tail = null;next = 0;playing = false;level = 0;stream?.getTracks().forEach(track => track.stop());stream = null;void capture?.close();void playback?.close();capture = playback = null;if (timer) clearInterval(timer);timer = undefined; }
function interrupted() {
  const now = playback?.currentTime ?? 0;
  for (const node of nodes) {
    try {
      if (node.startTime < now && node.endTime > now) {
        // Preserve the current envelope even if an attack/release is in flight.
        const end = Math.min(node.endTime, now + EDGE_FADE_SECONDS);
        const attack = now < node.attackEnd ? (now - node.startTime) / (node.attackEnd - node.startTime) : 1;
        const silenceAt = node.endTime - 1 / OUTPUT_RATE;
        const release = !node.releaseCancelled && now > node.releaseStart ? Math.max(0, (silenceAt - now) / (silenceAt - node.releaseStart)) : 1;
        node.envelope.gain.cancelScheduledValues(now);
        node.envelope.gain.setValueAtTime(Math.min(attack, release), now);
        node.envelope.gain.linearRampToValueAtTime(0, Math.max(now, end - 1 / OUTPUT_RATE));
        node.stop(end);
      } else node.stop(); // Queued speech must never start after an interruption.
    } catch { /* Already ended. */ }
  }
  nodes.clear();tail = null;next = 0;playing = false;level = 0;bridge.send({ type: 'output', playing: false, level: 0 });
}
async function start(command: AudioCommand) {
  if (starting) throw new Error('Already starting');starting = true;const current = generation;
  try {
    let deviceId: string | undefined;
    if (command.microphone) {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput' && device.deviceId !== 'default' && device.deviceId !== 'communications' && device.label === command.microphone);
      if (devices.length !== 1) throw new Error('Chosen microphone unavailable');deviceId = devices[0]!.deviceId;
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: { exact: true }, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }, video: false });
    if (current !== generation) { stream.getTracks().forEach(track => track.stop());return; }
    if (stream.getAudioTracks()[0]!.getSettings().echoCancellation !== true) throw new Error('Echo cancellation unavailable');
    volume = Math.max(0, Math.min(1, command.volume ?? 1));bufferSeconds = (command.bufferMs ?? 180) / 1000;
    // Match Gemini PCM: Chromium otherwise resamples each BufferSource in
    // isolation, changing boundary samples even on a gapless timeline. Output
    // device resampling now happens once, after the continuous context mix.
    playback = new AudioContext({ sampleRate: OUTPUT_RATE, latencyHint: 'interactive' });
    // Keep capture rendering on a silent sink. It must never open a second
    // audible output stream or send microphone audio back to the speakers.
    // Electron supports silent sinks; the DOM typings do not expose them yet.
    const captureOptions: AudioContextOptions & { sinkId: { type: 'none' } } = { sampleRate: 16000, latencyHint: 'interactive', sinkId: { type: 'none' } };
    capture = new AudioContext(captureOptions);
    const captureSink = (capture as AudioContext & { readonly sinkId: string | { type: 'none' } }).sinkId;
    if (typeof captureSink !== 'object' || captureSink.type !== 'none') throw new Error('Silent capture unavailable');
    await capture.audioWorklet.addModule('capture-worklet.js');
    const worklet = new AudioWorkletNode(capture, 'aether-live-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    worklet.port.onmessage = event => { if (current === generation) bridge.send({ type: 'input', ...event.data }); };
    await Promise.all([capture.resume(), playback.resume()]);
    const silent = capture.createGain();silent.gain.value = 0;
    metadata.capture = { sink: 'none', monitorGain: silent.gain.value, sampleRate: capture.sampleRate };
    bridge.send({ type: 'ready', echoCancellation: true, captureSilent: true });
    capture.createMediaStreamSource(stream).connect(worklet).connect(silent).connect(capture.destination);
    timer = setInterval(() => {
      if (!playback) return;
      const now = playback.currentTime, sampleTolerance = 1 / playback.sampleRate;
      // Browser clock quanta land on decimal buffer boundaries such as .88,
      // while summed durations can be .8800000000000002. Do not report a gap.
      const active = [...nodes].some(node => node.startTime <= now + sampleTolerance && node.endTime > now);
      if (active !== playing) { playing = active;metadata.transitions.push({at:playback.currentTime,playing});metadata.transitions=metadata.transitions.slice(-100);bridge.send({ type: 'output', playing, level: playing ? level : 0 }); }
    }, 20);
  } finally { starting = false; }
}
function play(pcm: Uint8Array) {
  if (!playback || !pcm.length || pcm.length % 2 || pcm.length > 512000) throw new Error('Invalid audio');
  const buffer = playback.createBuffer(1, pcm.length / 2, OUTPUT_RATE), samples = buffer.getChannelData(0), view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let energy = 0;for (let i = 0; i < samples.length; i++) { samples[i] = view.getInt16(i * 2, true) / 32768 * volume;energy += samples[i]! * samples[i]!; }level = Math.sqrt(energy / Math.max(1, samples.length));
  const now = playback.currentTime;
  // Keep normal joins untouched. If the tail has already begun fading after a
  // late packet, let it reach silence and rebuffer instead of jumping to gain 1.
  const continuous = tail !== null && next - now > EDGE_FADE_SECONDS;
  if (!continuous) next = Math.max(next, now) + bufferSeconds;
  if (next - now + buffer.duration > 8) throw new Error('Playback queue saturated');
  if (continuous && tail) {
    tail.envelope.gain.cancelAndHoldAtTime(tail.releaseStart);
    tail.envelope.gain.setValueAtTime(1, tail.releaseStart);tail.releaseCancelled = true;
  }
  metadata.scheduled.push({received:now,start:next,end:next+buffer.duration});metadata.scheduled=metadata.scheduled.slice(-100);
  const node = playback.createBufferSource() as PlaybackNode;
  node.buffer = buffer;node.startTime = next;node.endTime = next + buffer.duration;node.envelope = playback.createGain();
  const fade = Math.min(EDGE_FADE_SECONDS, Math.max(0, (buffer.duration - 1 / OUTPUT_RATE) / 2));
  node.attackEnd = continuous ? next : next + fade;
  node.releaseStart = node.endTime - 1 / OUTPUT_RATE - fade;node.releaseCancelled = false;
  node.envelope.gain.setValueAtTime(continuous || fade === 0 ? 1 : 0, next);
  if (!continuous && fade > 0) node.envelope.gain.linearRampToValueAtTime(1, next + fade);
  node.envelope.gain.setValueAtTime(1, node.releaseStart);
  node.envelope.gain.linearRampToValueAtTime(0, node.endTime - 1 / OUTPUT_RATE);
  node.connect(node.envelope).connect(playback.destination);nodes.add(node);tail = node;
  node.onended = () => { nodes.delete(node);if (tail === node) tail = null;node.disconnect();node.envelope.disconnect(); };
  node.start(next);next = node.endTime;
}
bridge.listen(command => {
  try {
    if (command.command === 'start') void start(command).catch(() => { stop();bridge.send({ type: 'error' }); });
    else if (command.command === 'play' && command.pcm instanceof Uint8Array) play(command.pcm);
    else if (command.command === 'interrupt') interrupted();
    else if (command.command === 'stop') stop();
    else throw new Error('Invalid command');
  } catch { stop();bridge.send({ type: 'error' }); }
});
window.addEventListener('pagehide', stop);
