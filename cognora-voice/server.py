"""
Cognora Voice Microservice Server

FastAPI server exposing Chatterbox-Turbo TTS on http://127.0.0.1:5005.
Zero external API keys required.
"""

import asyncio
import os
import sys
from contextlib import asynccontextmanager

# Add directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from services.chatterbox_service import ChatterboxService

service = ChatterboxService.get_instance()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: initialise model on startup, clean up on shutdown."""
    print("[COGNORA][VOICE][SERVER] Cognora Voice Service starting — loading Chatterbox-Turbo...")
    asyncio.create_task(service.initialize_model())
    yield
    print("[COGNORA][VOICE][SERVER] Cognora Voice Service shutting down.")


app = FastAPI(title="Cognora Voice Service", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str
    voiceId: str = "tutor_default"
    speed: float = 1.0
    exaggeration: float = 0.5
    cfgWeight: float = 0.5


@app.get("/health")
async def health():
    """
    Returns structured service health.

    modelState values:
      LOADING  — model is currently being loaded onto GPU
      READY    — model loaded successfully, synthesis available
      ERROR    — model failed to load (see modelError field)
    """
    status = service.get_status()
    if status.get("modelReady"):
        model_state = "READY"
    elif service.model_loading:
        model_state = "LOADING"
    else:
        model_state = "ERROR"

    return {
        **status,
        "modelState": model_state,
        "provider": "chatterbox",
        "model": "chatterbox-turbo",
        "status": "ok" if status.get("modelReady") else model_state.lower(),
    }


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty.")

    # If model is still loading, return 503 with a clear modelState
    if not service.model_ready:
        if service.model_loading:
            raise HTTPException(
                status_code=503,
                detail="Chatterbox model is still loading. Please retry in a moment.",
            )
        raise HTTPException(
            status_code=503,
            detail=f"Chatterbox model failed to load: {service.model_error or 'Unknown error'}",
        )

    try:
        wav_bytes, duration_ms = await service.synthesize(
            text=req.text,
            voice_id=req.voiceId,
            speed=req.speed,
            exaggeration=req.exaggeration,
        )

        print(
            f"[COGNORA][VOICE][CHATTERBOX][SYNTHESIS_SUCCESS]"
            f" textLength={len(req.text)} durationMs={duration_ms} audioBytes={len(wav_bytes)}"
        )

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration-Ms": str(duration_ms),
                "Cache-Control": "public, max-age=3600",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[COGNORA][VOICE][CHATTERBOX][SYNTHESIS_ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.environ.get("COGNORA_VOICE_PORT", 5005))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
