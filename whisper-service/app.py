"""
Whisper transcription microservice for Prebloom.
Accepts audio files, returns transcribed text.
Auto-detects GPU (CUDA) and falls back to CPU.
"""

import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from faster_whisper import WhisperModel

app = FastAPI(title="Prebloom Whisper Service")

# Model configuration
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")

# Auto-detect device: prefer CUDA GPU if available, else CPU
def get_device_config():
    """Detect best available device and compute type."""
    import platform
    
    try:
        import torch
        if torch.cuda.is_available():
            print(f"[whisper] CUDA GPU detected, using GPU acceleration")
            return "cuda", "float16"
    except ImportError:
        pass
    
    # Check for Apple Silicon (ARM) - int8 not supported, use float32
    machine = platform.machine().lower()
    if machine in ('arm64', 'aarch64'):
        print(f"[whisper] ARM architecture detected ({machine}), using float32")
        return "cpu", "float32"
    
    # x86/x64 Linux/Windows can use int8 for better performance
    print(f"[whisper] Using CPU with int8 quantization")
    return "cpu", "int8"

DEVICE, COMPUTE_TYPE = get_device_config()

# Load model once at startup
print(f"[whisper] Loading model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print(f"[whisper] Model loaded successfully")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Transcribe an audio file to text.
    
    Accepts: audio/webm, audio/wav, audio/mp3, audio/m4a, etc.
    Returns: { "text": "transcribed text...", "language": "en", "duration": 12.5 }
    """
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, f"Expected audio file, got {file.content_type}")
    
    # Save uploaded file to temp location
    suffix = _get_suffix(file.content_type)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Transcribe with faster-whisper
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language=None,  # Auto-detect language
            vad_filter=True,  # Filter out silence
        )
        
        # Combine all segments into single text
        text = " ".join(segment.text.strip() for segment in segments)
        
        return {
            "text": text,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
        }
    
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


def _get_suffix(content_type: str) -> str:
    """Get file suffix from content type."""
    mapping = {
        "audio/webm": ".webm",
        "audio/wav": ".wav",
        "audio/wave": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp3": ".mp3",
        "audio/mpeg": ".mp3",
        "audio/m4a": ".m4a",
        "audio/mp4": ".m4a",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
    }
    return mapping.get(content_type, ".audio")
