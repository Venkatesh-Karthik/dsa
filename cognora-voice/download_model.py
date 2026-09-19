"""
Model Downloader for Cognora Chatterbox-Turbo
Uses hf_transfer for multi-threaded Rust downloads with progress reporting.
"""

import os
import sys
import time

# Enable high-speed Rust-based hf_transfer
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

from huggingface_hub import snapshot_download

REPO_ID = "ResembleAI/chatterbox-turbo"

def main():
    print(f"[COGNORA][VOICE][DOWNLOAD] Starting accelerated download for {REPO_ID}...")
    t0 = time.time()
    try:
        path = snapshot_download(
            repo_id=REPO_ID,
            resume_download=True,
            max_workers=8,
        )
        dt = round(time.time() - t0, 1)
        print(f"[COGNORA][VOICE][DOWNLOAD] SUCCESS! Cached at {path} in {dt}s")
    except Exception as e:
        print(f"[COGNORA][VOICE][DOWNLOAD] ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
