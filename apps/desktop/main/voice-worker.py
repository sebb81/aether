"""Local audio worker. NDJSON over inherited pipes; no sockets or audio files."""
import base64
import hashlib
import io
import json
import math
import os
import queue
import sys
import threading
import time
import wave

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
import numpy as np
import sounddevice as sd
from scipy.signal import resample_poly

commands = queue.Queue()
eof = threading.Event()
model = None
model_path = None


def emit(request, kind, **values):
    print(json.dumps(dict(id=request, type=kind, **values), ensure_ascii=True), flush=True)


def read_commands():
    try:
        for line in sys.stdin:
            if len(line) > 4_000_000:
                break
            commands.put(json.loads(line))
    finally:
        eof.set()
        commands.put(None)


def key(device):
    host = sd.query_hostapis(device["hostapi"])["name"]
    return hashlib.sha256((host + "\0" + device["name"]).encode()).hexdigest()[:24]


def microphones():
    devices = sd.query_devices()
    wasapi = [i for i, d in enumerate(devices) if d["max_input_channels"] > 0 and sd.query_hostapis(d["hostapi"])["name"] == "Windows WASAPI"]
    selected = wasapi or [i for i, d in enumerate(devices) if d["max_input_channels"] > 0 and sd.query_hostapis(d["hostapi"])["name"] == "MME"]
    default = default_input_device()
    return [dict(id=key(devices[i]), name=devices[i]["name"], host=sd.query_hostapis(devices[i]["hostapi"])["name"], default=i == default) for i in selected]


def default_input_device():
    # Use the Windows shared-mode endpoint advertised by the same API as the picker.
    for host in sd.query_hostapis():
        device = int(host["default_input_device"])
        if host["name"] == "Windows WASAPI" and device >= 0:
            return device
    return int(sd.default.device[0])


def input_device(identifier):
    if identifier == "default":
        device = default_input_device()
        if device < 0:
            raise RuntimeError("Aucun microphone disponible.")
        return device
    matches = [i for i, d in enumerate(sd.query_devices()) if d["max_input_channels"] > 0 and key(d) == identifier]
    if len(matches) != 1:
        raise RuntimeError("Le microphone choisi est absent ou ambigu. Choisissez-le de nouveau dans VOICE.")
    return matches[0]


def encode_wav(samples, rate=16000):
    stream = io.BytesIO()
    with wave.open(stream, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    return base64.b64encode(stream.getvalue()).decode("ascii")


def decode_wav(encoded):
    data = base64.b64decode(encoded, validate=True)
    if len(data) > 2_500_000:
        raise RuntimeError("Extrait audio trop long.")
    with wave.open(io.BytesIO(data), "rb") as reader:
        if reader.getsampwidth() != 2 or reader.getcomptype() != "NONE":
            raise RuntimeError("Format audio attendu : WAV PCM 16 bits.")
        rate = reader.getframerate()
        channels = reader.getnchannels()
        samples = np.frombuffer(reader.readframes(reader.getnframes()), dtype="<i2").astype(np.float32) / 32768
        samples = samples.reshape(-1, channels).mean(axis=1)
    if rate != 16000:
        divisor = math.gcd(rate, 16000)
        samples = resample_poly(samples, 16000 // divisor, rate // divisor).astype(np.float32)
    return samples


def has_audio_signal(samples):
    # Endpoint detection is only a timing hint. Quiet, nonzero PCM must reach
    # Whisper's speech VAD instead of being discarded by a loudness threshold.
    if len(samples) < 1600:
        return False
    centered = samples - np.mean(samples)
    return float(np.max(np.abs(centered))) >= .0001


def mono_frame(data):
    if data.ndim == 1:
        return data.copy()
    # Some microphone arrays expose a silent first channel or opposite phases.
    # Keep the strongest real channel rather than averaging away the voice.
    channel = int(np.argmax(np.mean(data * data, axis=0)))
    return data[:, channel].copy()


def prepare_transcription(samples):
    if not has_audio_signal(samples):
        return None
    samples = samples - np.mean(samples)
    rms = float(np.sqrt(np.mean(samples * samples)))
    peak = float(np.max(np.abs(samples)))
    if rms < .025:
        gain = min(20.0, .025 / max(rms, .00001), .9 / peak)
        samples = samples * gain
    return samples.astype(np.float32)


def capture(request):
    device = input_device(request["microphone"])
    info = sd.query_devices(device)
    rate = int(info["default_samplerate"])
    channels = max(1, min(8, int(info["max_input_channels"])))
    frames = queue.Queue(maxsize=800)
    chunks = []
    detected = False
    start = time.monotonic()
    last_speech = start
    noise = .0001
    overflows = []
    last_level = 0

    def callback(data, _frames, _time, status):
        if status:
            overflows.append(str(status))
        try:
            frames.put_nowait(mono_frame(data))
        except queue.Full:
            overflows.append("capture queue full")

    # Driver buffering must absorb scheduler delays; a fixed small low-latency
    # buffer is unnecessary for dictation and can overflow on Windows devices.
    with sd.InputStream(device=device, samplerate=rate, channels=channels, dtype="float32", blocksize=0, callback=callback, latency="high") as stream:
        if not stream.active:
            raise RuntimeError("Le microphone n'a pas pu demarrer.")
        start = time.monotonic()
        last_speech = start
        emit(request["id"], "started", source="microphone")
        while not eof.is_set():
            try:
                control = commands.get_nowait()
                if control is None or (control.get("id") == request["id"] and control.get("op") == "finish"):
                    break
                raise RuntimeError("Operation audio concurrente refusee.")
            except queue.Empty:
                pass
            try:
                chunk = frames.get(timeout=.08)
            except queue.Empty:
                if time.monotonic() - start > 3:
                    raise RuntimeError("Le microphone ne fournit aucune trame audio. Verifiez les autorisations Windows.")
                continue
            chunks.append(chunk)
            now = time.monotonic()
            rms = float(np.sqrt(np.mean(chunk * chunk)))
            if now - start < .3 and rms < .001:
                noise = min(.0004, max(noise, rms))
            if rms > max(.001, noise * 2.3):
                detected = True
                last_speech = now
            if now - last_level >= .08:
                emit(request["id"], "level", level=min(1.0, rms * 5))
                last_level = now
            if (detected and now - last_speech > 1.4) or (not detected and now - start > 8) or now - start > 60:
                break
            if "capture queue full" in overflows:
                raise RuntimeError("Capture audio interrompue ou surchargee. Reessayez avec un autre microphone.")
    # The device is closed BEFORE any result/transcription is emitted.
    if eof.is_set():
        return
    samples = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
    if rate != 16000:
        divisor = math.gcd(rate, 16000)
        samples = resample_poly(samples, 16000 // divisor, rate // divisor).astype(np.float32)
    emit(request["id"], "result", wav=encode_wav(samples), durationMs=round(len(samples) / 16), speechDetected=has_audio_signal(samples), source="microphone")


def transcribe(request):
    global model, model_path
    location = request["modelPath"]
    if not os.path.isabs(location) or not all(os.path.isfile(os.path.join(location, name)) for name in ["model.bin", "config.json", "tokenizer.json"]):
        raise RuntimeError("Modele Whisper local absent ou incomplet. Choisissez son dossier dans VOICE.")
    samples = prepare_transcription(decode_wav(request["wav"]))
    if samples is None:
        emit(request["id"], "result", text="", language=request["language"])
        return
    from faster_whisper import WhisperModel
    if model is None or model_path != location:
        model = WhisperModel(location, device="cpu", compute_type="int8", cpu_threads=min(8, os.cpu_count() or 4), num_workers=1, local_files_only=True)
        model_path = location
    language = request["language"].split("-")[0]
    segments, info = model.transcribe(samples, language=language, beam_size=5, temperature=0, condition_on_previous_text=False, hotwords="AETHER, ENTITY", vad_filter=True, vad_parameters=dict(min_silence_duration_ms=700), no_speech_threshold=.6)
    text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < .65).strip()
    emit(request["id"], "result", text=text[:4000], language=info.language)


def playback(request):
    samples = decode_wav(request["wav"]) * float(request["volume"])
    device = int(sd.default.device[1])
    if device < 0:
        raise RuntimeError("Aucune sortie audio disponible. La reponse ecrite reste disponible.")
    rate = int(sd.query_devices(device)["default_samplerate"])
    if rate != 16000:
        divisor = math.gcd(rate, 16000)
        samples = resample_poly(samples, rate // divisor, 16000 // divisor).astype(np.float32)
    finished = threading.Event()
    progress = {"position": 0, "level": 0.0, "dac": None}
    output_status = []

    def callback(data, count, timing, status):
        if status:
            output_status.append(str(status))
        position = progress["position"]
        chunk = samples[position:position + count]
        data.fill(0)
        data[:len(chunk), 0] = chunk
        progress["position"] += len(chunk)
        progress["level"] = float(np.sqrt(np.mean(chunk * chunk))) if len(chunk) else 0.0
        if progress["dac"] is None and np.any(np.abs(chunk) > .0001):
            first = int(np.argmax(np.abs(chunk) > .0001))
            progress["dac"] = timing.outputBufferDacTime + first / rate
        if len(chunk) < count:
            raise sd.CallbackStop

    with sd.OutputStream(device=device, samplerate=rate, channels=1, dtype="float32", blocksize=0, latency="low", callback=callback, finished_callback=finished.set) as stream:
        started = False
        deadline = time.monotonic() + len(samples) / rate + 5
        while not finished.wait(.05):
            if eof.is_set():
                stream.abort()
                return
            if not started and progress["dac"] is not None and stream.time >= progress["dac"]:
                started = True
                emit(request["id"], "started")
            if started:
                emit(request["id"], "level", level=min(1.0, progress["level"] * 5))
            if time.monotonic() > deadline:
                raise RuntimeError("La lecture audio ne se termine pas. Lecture arretee.")
        if output_status:
            raise RuntimeError("La sortie audio a signale une interruption. Le texte reste disponible.")
    emit(request["id"], "result")


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    threading.Thread(target=read_commands, daemon=True).start()
    while not eof.is_set():
        request = commands.get()
        if request is None:
            break
        try:
            operation = request.get("op")
            if operation == "probe":
                import importlib.metadata
                emit(request["id"], "result", microphones=microphones(), version=importlib.metadata.version("faster-whisper"), runtime=sys.executable)
            elif operation == "capture":
                capture(request)
            elif operation == "transcribe":
                transcribe(request)
            elif operation == "play":
                playback(request)
            else:
                raise RuntimeError("Operation audio inconnue.")
        except Exception as error:
            emit(request.get("id"), "error", message=str(error)[:500])
        finally:
            request.clear()


if __name__ == "__main__":
    main()
