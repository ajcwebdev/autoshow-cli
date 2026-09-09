import { preflightCaptionEmbedding } from './embed-caption-tracks'
import { runTranscriptReview } from './run-transcript-review'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { runCaptionExport, validateCaptionOptions } from './run-caption-export'
import { defineCliCommand } from '~/cli/native/native-types'
import { extractStep2CommandFlags } from '~/cli/flags/extract-flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/download-targets/handle-process-target'
import { validateOcrProviderModeCommandFlags } from './step-2-ocr/command-validation'
import { runExtractTranscriptVideo } from './transcript-video/run-transcript-video'
import { UsageError } from '~/utils/error-handler'
import { withHelpGroup } from '~/cli/flags/flag-utils'
import type { CliFlagsDefinition } from '~/types'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, URL list (.md/.txt), or X Space link' }] as const

const transcriptVideoFlags = {
  'transcript-video': {
    description: 'Render a transcript video from a media extract output directory or manual audio/transcript files',
    type: Boolean,
    default: false,
    negatable: false
  },
  audio: {
    description: 'Transcript video: audio file for manual rendering, or override audio inferred from an extract run',
    type: String
  },
  'transcript-result': {
    description: 'Saved STT result.json for offline captions or transcript video',
    type: String
  },
  'transcript-text': {
    description: 'Transcript video: timestamped transcription.txt file to render',
    type: String
  },
  font: {
    description: 'Transcript video: font family used for rendered transcript text',
    type: String,
    default: 'DejaVu Sans'
  },
  'keep-tmp': {
    description: 'Transcript video: keep the per-run .transcript-video-tmp workspace in the output directory',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const captionFlags = {
  'embed-captions': { description: 'Embed selectable English subtitles into a copy of a local video (requires --captions)', type: Boolean, default: false, negatable: false },
  'caption-container': { description: 'Embedded video container: mp4|mkv|both (default source MP4/MKV, otherwise MKV)', type: String },
  captions: { description: 'Generate SRT/VTT from audio/video, or export offline from a saved result.json', type: Boolean, default: false, negatable: false },
  'caption-format': { description: 'Caption output: srt|vtt|both', type: String },
  'caption-offset': { description: 'Caption time offset in seconds (saved results default 0; fresh embedding uses source audio start)', type: String },
  'caption-mode': { description: 'Caption grouping: word|phrase', type: String },
  'caption-speakers': { description: 'Include speaker labels in exported captions (default on)', type: Boolean, negatable: true },
  'caption-line-width': { description: 'Maximum characters per subtitle line, except indivisible words', type: String },
  'caption-max-lines': { description: 'Maximum subtitle lines per cue (default 2)', type: String },
  'caption-max-cps': { description: 'Reading-speed threshold in characters/second; violations are recorded in captions.json', type: String },
  'caption-max-words': { description: 'Maximum words per phrase cue', type: String },
  'caption-max-characters': { description: 'Maximum characters per cue, except indivisible words', type: String },
  'caption-max-duration': { description: 'Maximum cue duration in seconds, except indivisible words', type: String },
  'caption-break-gap': { description: 'Silence gap in seconds that starts a new cue', type: String }
} as const satisfies CliFlagsDefinition

const extractFlags = {
  'docx-markdown': { description: 'Write extraction.md preserving local DOCX formatting (no providers)', type: Boolean },
  ...withHelpGroup({
    'transcript-review': { description: 'Export an offline word-indexed review packet and edit template from a saved result.json', type: Boolean },
    'transcript-edits': { description: 'Apply a reviewed edits.json to a saved transcript offline; save new result, transcript, and provenance', type: String }
  }, 'transcript-review'),
  ...withHelpGroup(captionFlags, 'captions'),
  ...extractStep2CommandFlags,
  ...withHelpGroup(transcriptVideoFlags, 'transcript-video')
} as const satisfies CliFlagsDefinition

const TRANSCRIPT_VIDEO_REQUIRING_FLAGS = [
  'audio',
  'transcript-result',
  'transcript-text',
  'font',
  'keep-tmp'
] as const

export const extractCommand = defineCliCommand({
  name: 'extract',
  description: 'Route media to STT and documents/articles/images to text extraction',
  parameters: inputParameter,
  flags: extractFlags,
  help: {
    examples: [
      ['bun autoshow extract https://youtube.com/watch?v=abc', 'Transcribe media with the default Whisper tiny STT model'],
      ['bun autoshow extract video.mp4 --provider groq --captions --caption-mode word', 'Transcribe media once and save synced SRT/VTT captions'],
      ['bun autoshow extract file.mp3 --provider assemblyai=universal-3-5-pro', 'Transcribe media with AssemblyAI STT'],
      ['bun autoshow extract video.mp4 --provider assemblyai=universal-3-5-pro --stt-audio-profile lossless', 'Transcribe verified float32 PCM and save its source timeline'],
      ['bun autoshow extract output/raw/result.json --transcript-review --output-dir output/review', 'Export an offline review packet and editable JSON template'],
      ['bun autoshow extract output/raw/result.json --transcript-edits output/review/edits.json --output-dir output/clean', 'Apply reviewed edits offline with timing provenance'],
      ['bun autoshow extract document.pdf --provider mistral=mistral-ocr-2512', 'Extract text from a document with Mistral OCR'],
      ['bun autoshow extract https://example.com/article --provider spider', 'Extract a remote article with a URL backend'],
      ['bun autoshow extract output/<extract-run-dir> --transcript-video', 'Render a synced speaker transcript video from a media extract run'],
      ['bun autoshow extract --transcript-video --audio input/audio.mp3 --transcript-result output/<extract-run-dir>/result.json', 'Render a transcript video from explicit files'],
      ['bun autoshow extract input/examples/batch/2-urls.md --batch-limit all', 'Process every routed item from a mixed input list'],
      ['bun autoshow extract https://x.com/i/spaces/1DXxyRYNejbKM', 'Extract X Space metadata via the X API']
    ]
  }
}, async (ctx) => {
  if (ctx.flags['docx-markdown'] === true) {
    const input = ctx.parameters.input
    if (!input || !input.toLowerCase().endsWith('.docx') || !((await stat(input).catch(() => undefined))?.isFile())) throw UsageError('--docx-markdown requires a local DOCX file.')
    const allowed = new Set(['docx-markdown', 'price', 'output-dir', 'output-root', 'json', 'quiet', 'verbose', 'log-level', 'color'])
    for (const flag of ctx.rawParsed.explicitFlags) if (!allowed.has(flag)) throw UsageError(`--${flag} cannot be combined with --docx-markdown.`)
    // Validate ZIP/XML before pricing or creating a workspace.
    const { readDocxMarkdown } = await import('./step-2-ocr/office/docx-markdown')
    await readDocxMarkdown(input)
  }
  if (ctx.flags['transcript-review'] === true || ctx.flags['transcript-edits'] !== undefined) {
    if (ctx.flags['transcript-review'] === true && ctx.flags['transcript-edits'] !== undefined) throw UsageError('--transcript-review and --transcript-edits are separate operations.')
    if (ctx.flags['captions'] === true || ctx.flags['transcript-video'] === true || ctx.flags['embed-captions'] === true || ctx.flags['price'] === true || ctx.rawParsed.explicitFlags.has('provider')) throw UsageError('Transcript review/apply is an offline operation; use separate commands for transcription, pricing, and captions.')
    await runTranscriptReview(ctx.parameters.input, typeof ctx.flags['transcript-edits'] === 'string' ? ctx.flags['transcript-edits'] : undefined)
    return
  }
  if (ctx.flags['captions'] === true) {
    if (ctx.flags['transcript-video'] === true) throw UsageError('--captions and --transcript-video cannot be combined.')
    validateCaptionOptions(ctx.flags)
    if (ctx.flags['caption-container'] !== undefined && ctx.flags['embed-captions'] !== true) throw UsageError('--caption-container requires --embed-captions.')
    if (ctx.flags['embed-captions'] === true) await preflightCaptionEmbedding(ctx.parameters.input, ctx.flags['caption-container'])
    const source = ctx.parameters.input
    const savedResult = typeof ctx.flags['transcript-result'] === 'string' || (typeof source === 'string' && (source.toLowerCase().endsWith('.json') || ((await stat(source).catch(() => undefined))?.isDirectory() && await Bun.file(join(source, 'result.json')).exists())))
    if (savedResult) {
      const incompatible = ['audio', 'transcript-text', 'font', 'keep-tmp', 'native-subtitles', 'diarization', 'stt-audio-profile', 'deepinfra-stt-response-format', 'stt-grok-verbatim', 'stt-supadata-chunk-size'].filter(flag => ctx.rawParsed.explicitFlags.has(flag))
      if (incompatible.length) throw UsageError('These options do not apply to saved-result caption export: ' + incompatible.map(flag => '--' + flag).join(', '))
      await runCaptionExport(ctx.parameters.input, ctx.flags)
      return
    }
  }
  if (ctx.flags['captions'] !== true && Object.keys(captionFlags).some(flag => flag !== 'captions' && ctx.rawParsed.explicitFlags.has(flag))) throw UsageError('Caption formatting flags require --captions.')
  const transcriptVideo = ctx.flags['transcript-video'] === true
  if (transcriptVideo) {
    await runExtractTranscriptVideo(ctx.parameters.input, ctx.flags)
    return
  }

  const transcriptVideoOnlyFlags = TRANSCRIPT_VIDEO_REQUIRING_FLAGS
    .filter((flag) => ctx.rawParsed.explicitFlags.has(flag))
    .map((flag) => `--${flag}`)
  if (transcriptVideoOnlyFlags.length > 0) {
    throw UsageError(`${transcriptVideoOnlyFlags.join(', ')} require --transcript-video`)
  }

  validateOcrProviderModeCommandFlags(ctx)
  await handleProcessTarget('extract', ctx.parameters.input, ctx.flags, ctx.rawParsed)
})
