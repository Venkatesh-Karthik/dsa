"""
Chatterbox Standalone Smoke Test

Verifies:
1. PyTorch / CUDA detection on RTX 4050
2. Model loading
3. Synthesis of a test sentence
4. Non-empty WAV output
"""

import asyncio
import os
import sys

# Ensure cognora-voice is on python path
sys.path.insert(0, os.path.dirname(__file__))

from services.chatterbox_service import ChatterboxService

async def run_smoke_test():
    print("=== COGNORA CHATTERBOX STANDALONE SMOKE TEST ===")
    service = ChatterboxService.get_instance()
    
    print(f"Device: {service.device}")
    status = service.get_status()
    print(f"Initial Status: {status}")

    print("Initializing model...")
    ok = await service.initialize_model()
    if not ok:
        print(f"Model initialization FAILED: {service.model_error}")
        sys.exit(1)

    print("Model initialized successfully!")
    print(f"Updated Status: {service.get_status()}")

    test_text = "Binary search repeatedly divides the search interval in half."
    print(f"Synthesizing test sentence: \"{test_text}\"")

    wav_bytes, duration_ms = await service.synthesize(test_text)
    
    out_file = os.path.join(os.path.dirname(__file__), "smoke_test_output.wav")
    with open(out_file, "wb") as f:
        f.write(wav_bytes)

    assert os.path.exists(out_file), "Output WAV file does not exist!"
    file_size = os.path.getsize(out_file)
    assert file_size > 1000, f"Output WAV file is suspiciously small: {file_size} bytes"

    print(f"SUCCESS: WAV generated ({file_size} bytes, duration ~{duration_ms}ms) at {out_file}")
    print("=== SMOKE TEST PASSED ===")

if __name__ == "__main__":
    asyncio.run(run_smoke_test())
