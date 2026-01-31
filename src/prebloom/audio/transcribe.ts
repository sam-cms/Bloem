/**
 * Audio transcription module for Prebloom.
 * Calls the whisper-service sidecar for speech-to-text,
 * then optionally applies the transcription skill for cleanup.
 */

import { applySkill, listSkills } from "../skills/index.js";

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || "http://localhost:8000";

export interface TranscriptionResult {
  text: string;
  rawText: string;
  language: string;
  duration: number;
  cleaned: boolean;
}

/**
 * Transcribe audio buffer to text.
 *
 * @param audioBuffer - Raw audio data
 * @param contentType - MIME type (e.g., "audio/webm")
 * @param clean - Whether to apply transcription skill for cleanup (default: true)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  contentType: string,
  clean = true,
): Promise<TranscriptionResult> {
  // Create form data with the audio file
  // Copy buffer to a fresh ArrayBuffer (avoids SharedArrayBuffer type issues)
  const formData = new FormData();
  const arrayBuffer = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: contentType });
  formData.append("file", blob, `audio${getExtension(contentType)}`);

  // Call whisper service
  const response = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper service error: ${error}`);
  }

  const result = (await response.json()) as {
    text: string;
    language: string;
    duration: number;
  };

  const rawText = result.text;
  let finalText = rawText;
  let cleaned = false;

  // Apply transcription skill if available and requested
  if (clean && rawText.trim()) {
    const skills = listSkills();
    const transcriptionSkill = skills.find((s) => s.id === "transcription");

    if (transcriptionSkill) {
      try {
        const skillResult = await applySkill(transcriptionSkill, {
          text: rawText,
          agent: "whisper-transcription",
          metadata: { source: "voice-input" },
        });
        if (skillResult.applied && skillResult.text) {
          finalText = skillResult.text;
          cleaned = true;
        }
      } catch (error) {
        // Fall back to raw text if skill fails
        console.error("Transcription skill failed, using raw text:", error);
      }
    }
  }

  return {
    text: finalText,
    rawText,
    language: result.language,
    duration: result.duration,
    cleaned,
  };
}

/**
 * Check if whisper service is available.
 */
export async function checkWhisperHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${WHISPER_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function getExtension(contentType: string): string {
  const mapping: Record<string, string> = {
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
  };
  return mapping[contentType] || ".audio";
}
