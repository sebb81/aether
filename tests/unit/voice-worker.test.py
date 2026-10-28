"""Capture/STT regressions; no microphone is opened and no audio is retained."""
import importlib.util
from pathlib import Path
import unittest
import queue
from unittest.mock import patch

import numpy as np

location = Path(__file__).resolve().parents[2] / "apps/desktop/main/voice-worker.py"
spec = importlib.util.spec_from_file_location("aether_voice_worker", location)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class VoiceWorkerTests(unittest.TestCase):
    def test_capture_keeps_quiet_second_channel_until_stt_and_closes_device_first(self):
        events = []
        stream_options = {}
        clock = [0.0]
        speech = (.0005 * np.sin(2 * np.pi * 220 * np.arange(1280) / 16000)).astype(np.float32)

        class Driver:
            active = True
            closed = False

            def __init__(self, **options):
                stream_options.update(options)
                self.callback = options["callback"]

            def __enter__(self):
                for _ in range(130):
                    self.callback(np.column_stack([np.zeros_like(speech), speech]), 1280, None, None)
                return self

            def __exit__(self, *_args):
                Driver.closed = True

        def monotonic():
            clock[0] += .08
            return clock[0]

        def emit(request, kind, **values):
            if kind == "result":
                self.assertTrue(Driver.closed)
            events.append(dict(type=kind, **values))

        with patch.object(worker, "input_device", return_value=18), patch.object(worker.sd, "query_devices", return_value={"default_samplerate": 16000, "max_input_channels": 2}), patch.object(worker.sd, "InputStream", Driver), patch.object(worker.time, "monotonic", monotonic), patch.object(worker, "commands", queue.Queue()), patch.object(worker, "emit", emit):
            worker.capture({"id": "quiet-capture", "microphone": "default"})
        self.assertEqual(stream_options["channels"], 2)
        self.assertEqual(stream_options["blocksize"], 0)
        self.assertEqual(events[0]["type"], "started")
        self.assertTrue(events[-1]["speechDetected"])
        self.assertGreater(max(value["level"] for value in events if value["type"] == "level"), 0)
        self.assertTrue(worker.has_audio_signal(worker.decode_wav(events[-1]["wav"])))

    def test_quiet_voice_reaches_stt_below_previous_peak_gate(self):
        samples = (.0007 * np.sin(2 * np.pi * 220 * np.arange(16000) / 16000)).astype(np.float32)
        self.assertLess(np.max(np.abs(samples)), .002)
        self.assertTrue(worker.has_audio_signal(samples))
        prepared = worker.prepare_transcription(samples)
        self.assertIsNotNone(prepared)
        self.assertGreater(np.max(np.abs(prepared)), np.max(np.abs(samples)) * 10)
        self.assertLessEqual(np.max(np.abs(prepared)), .9)

    def test_silence_dc_and_short_accidental_click_do_not_reach_stt(self):
        for samples in [np.zeros(16000, dtype=np.float32), np.ones(16000, dtype=np.float32) * .01, np.ones(300, dtype=np.float32)]:
            self.assertFalse(worker.has_audio_signal(samples))
            self.assertIsNone(worker.prepare_transcription(samples))

    def test_arrays_keep_voice_when_first_channel_is_silent_or_phases_cancel(self):
        speech = np.sin(np.arange(100) / 8).astype(np.float32) * .002
        for frame in [np.column_stack([np.zeros_like(speech), speech]), np.column_stack([speech, -speech])]:
            np.testing.assert_allclose(worker.mono_frame(frame), speech)

    def test_default_picker_and_capture_use_the_same_wasapi_endpoint(self):
        hosts = [{"name": "MME", "default_input_device": 1}, {"name": "Windows WASAPI", "default_input_device": 18}]
        with patch.object(worker.sd, "query_hostapis", return_value=hosts):
            self.assertEqual(worker.input_device("default"), 18)
        with patch.object(worker.sd, "query_hostapis", return_value=[]):
            self.assertEqual(worker.input_device("default"), int(worker.sd.default.device[0]))


if __name__ == "__main__":
    unittest.main()
