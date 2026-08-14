export const HELP_COMMAND_GROUPS = [
  ['core', 'Core Commands'],
  ['setup', 'Setup & Utilities'],
  ['processing', 'Processing & Generation']
] as const

// Section order for grouped flag help on *every* command, not just `config`.
// `renderGroupedFlags` walks this list and prints each group that some flag
// claims via `withHelpGroup`, then dumps whatever is left in an unlabeled
// trailing block — so a group missing from here does not error, it silently
// renders ungrouped. `help-flag-groups.test.ts` pins the two sides equal.
export const HELP_FLAG_GROUPS = [
  ['config', 'Config'],
  ['document-options', 'Document Options'],
  ['metadata-output', 'Metadata Output'],
  ['media-download', 'Media Download Options'],
  ['concurrency', 'Concurrency'],
  ['provider-selection', 'Provider Selection'],
  ['pipeline', 'Pipeline Selection'],
  ['batch-download', 'Batch / Download'],
  ['step-2-stt', 'Step 2 - Transcribe'],
  ['transcription', 'Transcription / STT'],
  ['step-2-ocr', 'Step 2 - OCR'],
  ['extraction', 'Extraction'],
  ['ocr-document', 'OCR / Document Extraction'],
  ['article-extraction', 'Article Extraction'],
  ['batch-processing', 'Batch Processing'],
  ['epub-inspect', 'EPUB Inspect'],
  ['transcript-video', 'Transcript Video'],
  ['step-3-write', 'Step 3 - Write'],
  ['writing', 'Writing'],
  ['step-4-tts', 'Step 4 - Text to Speech'],
  ['tts-options', 'TTS Options'],
  ['tts-minimax', 'MiniMax TTS'],
  ['tts-deepgram', 'Deepgram TTS'],
  ['tts-speechify', 'Speechify TTS'],
  ['tts-hume', 'Hume TTS'],
  ['tts-dialogue', 'Multi-Speaker / Dialogue'],
  ['tts-elevenlabs', 'ElevenLabs TTS'],
  ['step-5-image', 'Step 5 - Image'],
  ['image-options', 'Image Options'],
  ['image-inputs', 'Image Inputs'],
  ['image-provider-options', 'Provider-Specific Image Options'],
  ['step-6-video', 'Step 6 - Video'],
  ['video-options', 'Video Options'],
  ['video-inputs', 'Video Inputs'],
  ['replicate-video', 'Replicate Video'],
  ['fal-video', 'fal.ai Video'],
  ['grok-storage', 'Grok Storage Options'],
  ['step-7-music', 'Step 7 - Music'],
  ['hosted-music', 'Hosted Music'],
  ['comic-panels', 'Panel Selection'],
  ['comic-reference', 'Reference Sheet'],
  ['comic-image', 'Image Options'],
  ['comic-qa', 'Image QA'],
  ['comic-stages', 'Scene Drafting'],
  ['comic-audio', 'Comic Audio'],
  ['comic-presentation', 'Comic Presentation'],
  ['comic-run', 'Run Options'],
  ['pricing', 'Pricing'],
  ['lyric-video', 'Lyric Video']
] as const
