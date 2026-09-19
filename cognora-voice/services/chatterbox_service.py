"""
Chatterbox TTS Service Singleton for Cognora

Manages lifecycle of Resemble AI's Chatterbox-Turbo model.
Loads once onto NVIDIA CUDA GPU (or CPU fallback) and keeps warm in memory.
"""

import asyncio
import io
import logging
import os
import re
import time
from typing import Optional, Tuple

import numpy as np
import soundfile as sf
import torch

logging.basicConfig(level=logging.INFO, format="[COGNORA][VOICE][%(levelname)s] %(message)s")
logger = logging.getLogger("cognora-voice")

class ChatterboxService:
    _instance: Optional["ChatterboxService"] = None

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None
        self.model_ready = False
        self.model_loading = False
        self.model_error: Optional[str] = None
        self._lock = asyncio.Lock()
        self.voices_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "voices")
        os.makedirs(self.voices_dir, exist_ok=True)
        self.default_reference_audio = os.path.join(self.voices_dir, "tutor_reference.wav")

    @classmethod
    def get_instance(cls) -> "ChatterboxService":
        if cls._instance is None:
            cls._instance = ChatterboxService()
        return cls._instance

    def get_status(self) -> dict:
        vram_used = 0
        if torch.cuda.is_available():
            vram_used = int(torch.cuda.memory_allocated() / (1024 * 1024))

        return {
            "modelReady": self.model_ready,
            "device": self.device,
            "gpuName": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None",
            "vramUsedMb": vram_used,
            "modelError": self.model_error,
        }

    async def initialize_model(self) -> bool:
        if self.model_ready:
            return True

        async with self._lock:
            if self.model_ready:
                return True

            self.model_loading = True
            t0 = time.time()
            logger.info(f"Initializing Chatterbox-Turbo model on device: {self.device}...")

            try:
                # Run synchronous model loading in threadpool to keep event loop responsive
                await asyncio.to_thread(self._load_model_sync)
                self.model_ready = True
                self.model_loading = False
                load_time = round(time.time() - t0, 2)
                logger.info(f"Chatterbox-Turbo successfully loaded in {load_time}s on {self.device}.")
                return True
            except Exception as e:
                self.model_loading = False
                self.model_ready = False
                self.model_error = str(e)
                logger.error(f"Failed to load Chatterbox-Turbo: {e}", exc_info=True)
                return False

    def _load_model_sync(self):
        # Try loading ChatterboxTurboTTS first, then fallback to ChatterboxTTS if turbo unavailable
        try:
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            self.model = ChatterboxTurboTTS.from_pretrained(device=self.device)
            logger.info("Loaded ChatterboxTurboTTS.")
        except (ImportError, AttributeError):
            from chatterbox.tts import ChatterboxTTS
            self.model = ChatterboxTTS.from_pretrained(device=self.device)
            logger.info("Loaded standard ChatterboxTTS.")

        # Ensure default reference voice audio exists
        if not os.path.exists(self.default_reference_audio):
            self._generate_default_reference_clip()

    def _generate_default_reference_clip(self):
        """Generates a clean reference audio file if none provided for zero-shot cloning."""
        sr = 24000
        # 3 seconds of calm tone harmonics
        t = np.linspace(0, 3, sr * 3, endpoint=False)
        # Gentle harmonic carrier to avoid distortion
        carrier = 0.1 * np.sin(2 * np.pi * 220 * t) + 0.05 * np.sin(2 * np.pi * 440 * t)
        sf.write(self.default_reference_audio, carrier.astype(np.float32), sr)

    async def synthesize(
        self,
        text: str,
        voice_id: str = "tutor_default",
        speed: float = 1.0,
        exaggeration: float = 0.5,
    ) -> Tuple[bytes, int]:
        if not self.model_ready:
            ok = await self.initialize_model()
            if not ok:
                raise RuntimeError(f"Chatterbox model not ready: {self.model_error}")

        # Split long explanations into manageable sentence chunks to prevent hallucination
        sentences = self._split_into_sentences(text)
        if not sentences:
            sentences = [text]

        t0 = time.time()
        logger.info(f"Synthesizing {len(sentences)} sentence chunks...")

        audio_chunks = []
        sample_rate = getattr(self.model, "sr", 24000)

        for sent in sentences:
            chunk = await asyncio.to_thread(self._synthesize_single_sentence, sent, voice_id)
            if chunk is not None and len(chunk) > 0:
                audio_chunks.append(chunk)
                # Add 120ms natural pause between sentences
                pause_samples = int(sample_rate * 0.12)
                audio_chunks.append(np.zeros(pause_samples, dtype=np.float32))

        if not audio_chunks:
            raise RuntimeError("Synthesis produced no audio data.")

        full_audio = np.concatenate(audio_chunks)

        # Apply speed adjustment if requested and scipy is available
        if abs(speed - 1.0) > 0.05:
            full_audio = self._adjust_speed(full_audio, speed)

        # Encode to WAV buffer
        buf = io.BytesIO()
        sf.write(buf, full_audio, sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buf.getvalue()
        duration_ms = int((len(full_audio) / sample_rate) * 1000)
        synth_time = round(time.time() - t0, 2)
        logger.info(f"Synthesis complete in {synth_time}s ({duration_ms}ms audio).")

        return wav_bytes, duration_ms

    def _synthesize_single_sentence(self, sentence: str, voice_id: str) -> np.ndarray:
        custom_clip = os.path.join(self.voices_dir, f"{voice_id}.wav")
        ref_clip = custom_clip if os.path.exists(custom_clip) else None

        with torch.no_grad():
            try:
                if hasattr(self.model, "generate"):
                    if ref_clip:
                        res = self.model.generate(sentence, audio_prompt_path=ref_clip)
                    else:
                        res = self.model.generate(sentence)
                else:
                    res = self.model(sentence)

                if isinstance(res, torch.Tensor):
                    res = res.detach().cpu().squeeze().numpy()
                elif isinstance(res, (list, tuple)):
                    res = np.array(res, dtype=np.float32)

                return res.astype(np.float32)
            except Exception as e:
                logger.error(f"Single sentence synthesis failed: {e}")
                return np.zeros(1000, dtype=np.float32)

    def _split_into_sentences(self, text: str) -> list[str]:
        # Split on sentence boundaries preserving meaning
        parts = re.split(r"(?<=[.!?])\s+", text.strip())
        return [p.strip() for p in parts if p.strip()]

    def _adjust_speed(self, audio: np.ndarray, speed: float) -> np.ndarray:
        try:
            from scipy import signal
            num_samples = int(len(audio) / speed)
            return signal.resample(audio, num_samples).astype(np.float32)
        except Exception:
            return audio
