FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download model on build (small model ~460MB, good balance of speed/quality)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
