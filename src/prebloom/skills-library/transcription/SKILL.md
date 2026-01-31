---
name: transcription
version: 1.0.0
description: Process and clean up transcribed audio/speech into readable text.
apply: pre
agents:
  - intake
---

# Transcription Processor

Clean up speech-to-text transcriptions into readable, structured text suitable for analysis.

## Purpose

Audio transcriptions often contain:
- Filler words (um, uh, like, you know)
- False starts and repetitions
- Run-on sentences without punctuation
- Incomplete thoughts
- Speaker disfluencies

This skill transforms raw transcriptions into clean, readable text while preserving the speaker's intent and meaning.

## Processing Rules

### Remove Filler Words
Remove without changing meaning:
- um, uh, er, ah
- like (when used as filler, not comparison)
- you know, I mean, kind of, sort of (when meaningless)
- basically, literally (when overused)
- so (at sentence starts when meaningless)

### Fix Repetitions and False Starts
- "I think I think we should" → "I think we should"
- "The the problem is" → "The problem is"
- "We need to, we need to focus" → "We need to focus"

### Add Punctuation
- Insert periods at natural sentence boundaries
- Add commas for clarity
- Use question marks for questions
- Break run-on sentences

### Preserve Meaning
- Keep all substantive content
- Maintain the speaker's voice and style
- Don't add information not present
- Don't remove meaningful hedging (actual uncertainty)

### Structure Long Transcriptions
For longer content:
- Break into logical paragraphs
- Identify distinct topics or sections
- Maintain chronological flow

## Input Format

The input may be:
- Raw transcription text
- Timestamped transcription (remove timestamps, keep text)
- Multiple speakers (preserve speaker labels if present)

## Output Format

Return clean, readable text that:
- Uses proper punctuation and capitalization
- Flows naturally when read
- Preserves all meaningful content
- Is ready for further analysis

## Example

**Input:**
```
so um basically what we're trying to do is we're trying to build like a a platform for um you know for startup founders who want to like validate their ideas before they you know spend all their money um and basically the the problem is that most founders they they just build without without talking to customers first you know
```

**Output:**
```
We're building a platform for startup founders who want to validate their ideas before spending their money. The problem is that most founders build without talking to customers first.
```

Return ONLY the processed text. No explanations or commentary.
