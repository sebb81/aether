"""Duplex LIVE PCM, inherited pipes only. No secret, sockets or audio on disk."""
import base64
import collections
import json
import importlib.util
import math
from pathlib import Path
import queue
import re
import sys
import threading
import time

import numpy as np
import sounddevice as sd
from scipy.signal import resample_poly

spec = importlib.util.spec_from_file_location("aether_voice_worker", Path(__file__).with_name("voice-worker.py"))
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)


def convert(samples, source, target):
    divisor = math.gcd(source, target)
    return resample_poly(samples, target // divisor, source // divisor).astype(np.float32)


def run():
    first = json.loads(sys.stdin.readline())
    if first.get("command") != "start":
        raise RuntimeError("Invalid start")
    fixture_folder = Path(first["fixtureFolder"]).resolve() if first.get("fixtureFolder") else None
    device = None if fixture_folder else voice.input_device(first["microphone"])
    info = None if fixture_folder else sd.query_devices(device)
    input_rate = 16000 if fixture_folder else int(info["default_samplerate"])
    output_device = int(sd.default.device[1])
    for host in sd.query_hostapis():
        if host["name"] == "Windows WASAPI" and int(host["default_output_device"]) >= 0:
            output_device = int(host["default_output_device"])
            break
    output_rate = int(sd.query_devices(output_device)["default_samplerate"])
    output_channels = min(2, int(sd.query_devices(output_device)["max_output_channels"]))
    channels = 1 if fixture_folder else min(2, int(info["max_input_channels"]))
    volume = max(0, min(1, float(first.get("volume", 1))))
    captured = queue.Queue(maxsize=100)
    outgoing = queue.Queue(maxsize=120)
    commands = queue.Queue(maxsize=100)
    stopping = threading.Event()
    overflow = threading.Event()
    playback = collections.deque()
    lock = threading.Lock()
    playback_size = 0
    played = False
    previous_output = 0

    def emit(**value):
        try:
            outgoing.put_nowait(value)
        except queue.Full:
            overflow.set()

    def writer():
        while not stopping.is_set():
            try:
                value = outgoing.get(timeout=0.1)
                print(json.dumps(value, ensure_ascii=True), flush=True)
            except queue.Empty:
                continue
            except (BrokenPipeError, OSError):
                stopping.set()

    def reader():
        try:
            for line in sys.stdin:
                if len(line) > 700000:
                    break
                commands.put(json.loads(line), timeout=1)
        finally:
            stopping.set()

    def capture(data, frames, timing, status):
        if status.input_overflow:
            overflow.set()
        try:
            captured.put_nowait(data.copy())
        except queue.Full:
            overflow.set()

    def fixture_capture():
        # Isolated development recipes only: real provider and native audio output.
        samples = np.zeros(0, dtype=np.float32)
        seen = set()
        next_frame = time.monotonic()
        while not stopping.is_set():
            for path in sorted(fixture_folder.iterdir()):
                if path.name in seen or not re.fullmatch(r"[0-9]+\.wav", path.name) or path.is_symlink() or not path.is_file():
                    continue
                raw = path.read_bytes()
                if len(raw) > 2500000:
                    overflow.set()
                    return
                samples = np.concatenate((samples, voice.decode_wav(base64.b64encode(raw).decode("ascii"))))
                seen.add(path.name)
            block = samples[:320]
            samples = samples[320:]
            block = np.pad(block, (0, 320 - len(block)))
            try:
                captured.put_nowait(block[:, None])
            except queue.Full:
                overflow.set()
            next_frame += 0.02
            stopping.wait(max(0, next_frame - time.monotonic()))
    def output(data, frames, timing, status):
        nonlocal playback_size, played, previous_output
        data.fill(0)
        filled = 0
        with lock:
            while playback and filled < frames:
                block = playback[0]
                take = min(len(block), frames - filled)
                data[filled:filled + take, :] = block[:take, None]
                filled += take
                playback_size -= take
                if take == len(block):
                    playback.popleft()
                else:
                    playback[0] = block[take:]
        now = time.monotonic()
        is_playing = filled > 0
        if played != is_playing or now - previous_output > 0.08 and is_playing:
            level = float(np.sqrt(np.mean(data * data))) if is_playing else 0
            emit(type="output", playing=is_playing, level=min(1, level))
            previous_output = now
        played = is_playing

    threading.Thread(target=writer, daemon=True).start()
    threading.Thread(target=reader, daemon=True).start()
    noise = 0.0003
    speaking = False
    active_ms = 0
    silent_ms = 0
    # Callback streams keep recording while the output plays. No STT/TTS here.
    import contextlib
    with sd.OutputStream(device=output_device, samplerate=output_rate, channels=output_channels, dtype="float32", callback=output, blocksize=int(output_rate * 0.02), latency="low"):
        microphone = contextlib.nullcontext() if fixture_folder else sd.InputStream(device=device, samplerate=input_rate, channels=channels, dtype="float32", callback=capture, blocksize=0, latency="high")
        with microphone:
            if fixture_folder:
                threading.Thread(target=fixture_capture, daemon=True).start()
            emit(type="ready")
            while not stopping.is_set():
                if overflow.is_set():
                    raise RuntimeError("Audio queue or driver overflow")
                while True:
                    try:
                        command = commands.get_nowait()
                    except queue.Empty:
                        break
                    if command.get("command") == "interrupt":
                        with lock:
                            playback.clear()
                            playback_size = 0
                        emit(type="output", playing=False, level=0)
                    elif command.get("command") == "play":
                        raw = base64.b64decode(command["pcm"], validate=True)
                        if len(raw) > 512000 or len(raw) % 2:
                            raise RuntimeError("Invalid PCM")
                        samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
                        samples = convert(samples, 24000, output_rate) * volume
                        with lock:
                            if playback_size + len(samples) > output_rate * 8:
                                raise RuntimeError("Output queue too long")
                            playback.append(samples)
                            playback_size += len(samples)
                    else:
                        raise RuntimeError("Invalid command")
                try:
                    block = captured.get(timeout=0.01)
                except queue.Empty:
                    continue
                # Preserve J5.5's strongest channel, avoid cancellation between channels.
                energies = np.mean(block * block, axis=0)
                mono = block[:, int(np.argmax(energies))]
                samples = convert(mono, input_rate, 16000)
                level = float(np.sqrt(np.mean(samples * samples)))
                duration = len(samples) / 16
                threshold = max(0.0015, noise * 3.5)
                if level > threshold:
                    active_ms += duration
                    silent_ms = 0
                    if active_ms >= 60:
                        speaking = True
                else:
                    silent_ms += duration
                    active_ms = 0
                    if silent_ms >= 300:
                        speaking = False
                    if not speaking and not played:
                        noise = noise * 0.98 + level * 0.02
                # Bound each NDJSON frame to <= 100 ms, continuous audio includes silence.
                for offset in range(0, len(samples), 1600):
                    pcm = (np.clip(samples[offset:offset + 1600], -1, 1) * 32767).astype("<i2").tobytes()
                    emit(type="input", pcm=base64.b64encode(pcm).decode("ascii"), level=min(1, level), speech=speaking)
    stopping.set()


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # Runtime failures are deliberately generic and cannot contain audio or paths.
        print(json.dumps(dict(type="error")), flush=True)
        sys.exit(1)
