FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model during build (medium model ~1.5GB)
# This caches the model in the image for faster container starts
# Using float32 for cross-platform compatibility (Linux x86 + Mac ARM)
ARG WHISPER_MODEL=medium
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='float32')"

COPY app.py .

# Model cache directory (can be mounted as volume for persistence)
ENV HF_HOME=/app/.cache/huggingface

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
