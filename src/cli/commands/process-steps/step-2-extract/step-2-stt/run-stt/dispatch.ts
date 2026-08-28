import type { Step2Metadata, SttDispatchContext, SttDispatcher, SttTarget, SttTargetOptions, TranscriptionResult, WhisperProgressWindow } from '~/types'
import { InternalError, UsageError } from '~/utils/error-handler'
import { runWhisperTranscribe } from '../stt-local/whisper/run-whisper'
import { runWhisperfileTranscribe } from '../stt-local/whisperfile/run-whisperfile'
import { runAssemblyAiTranscribe } from '../stt-services/assemblyai/run-assemblyai-stt'
import { runDeepgramTranscribe } from '../stt-services/stt-deepgram/run-deepgram-stt'
import { runDeepinfraTranscribe } from '../stt-services/deepinfra/run-deepinfra-stt'
import { runGeminiStt } from '../stt-services/gemini-stt/run-gemini-stt'
import { runGladiaStt } from '../stt-services/gladia/run-gladia-stt'
import { runGrokStt } from '../stt-services/stt-grok/run-grok-stt'
import { runGroqTranscribe } from '../stt-services/stt-groq/run-whisper-groq'
import { runHappyScribeStt } from '../stt-services/happyscribe/run-happyscribe-stt'
import { runMistralStt } from '../stt-services/stt-mistral/run-mistral-stt'
import { runScrapeCreatorsStt } from '../stt-services/scrapecreators/run-scrapecreators-stt'
import { runSonioxStt } from '../stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from '../stt-services/speechmatics/run-speechmatics-stt'
import { runSupadataStt } from '../stt-services/stt-supadata/run-supadata-stt'
import { runTogetherStt } from '../stt-services/together/run-together-stt'

const minimalOptions = (context: SttDispatchContext) => ({
  model: context.target.model,
  segmentOffsetMinutes: context.segmentOffsetMinutes,
  segmentNumber: context.segmentNumber,
  totalSegments: context.totalSegments
})

const basicOptions = (context: SttDispatchContext) => ({
  ...minimalOptions(context),
  audioDurationSeconds: context.options.audioDurationSeconds
})

const asyncJobOptions = (context: SttDispatchContext) => ({
  ...basicOptions(context),
  diarizationOptions: context.target.diarizationOptions,
  runMode: context.options.runMode,
  lifecycle: context.options.asyncLifecycle
})

const whisperOptions = (context: SttDispatchContext) => ({
  ...basicOptions(context),
  segmentStartSeconds: context.whisperProgress?.segmentStartSeconds,
  segmentDurationSeconds: context.whisperProgress?.segmentDurationSeconds,
  totalDurationSeconds: context.whisperProgress?.totalDurationSeconds,
  preserveJson: true
})

const sttDispatchers = {
  deepgram: async context => await runDeepgramTranscribe(context.audioPath, context.outputDir, minimalOptions(context)),
  deepinfra: async context => await runDeepinfraTranscribe(context.audioPath, context.outputDir, basicOptions(context)),
  soniox: async context => await runSonioxStt(context.audioPath, context.outputDir, asyncJobOptions(context)),
  speechmatics: async context => await runSpeechmaticsStt(context.audioPath, context.outputDir, asyncJobOptions(context)),
  rev: async () => {
    throw UsageError('Rev STT is retired and cannot dispatch. Start a new target with an active STT provider.')
  },
  groq: async context => await runGroqTranscribe(context.audioPath, context.outputDir, basicOptions(context)),
  grok: async context => await runGrokStt(context.audioPath, context.outputDir, minimalOptions(context)),
  whisper: async context => await runWhisperTranscribe(context.audioPath, context.outputDir, whisperOptions(context)),
  whisperfile: async context => await runWhisperfileTranscribe(context.audioPath, context.outputDir, whisperOptions(context)),
  mistral: async context => await runMistralStt(context.audioPath, context.outputDir, {
    ...minimalOptions(context),
    diarizationOptions: context.target.diarizationOptions,
    passController: context.options.mistralPassController
  }),
  assemblyai: async context => await runAssemblyAiTranscribe(context.audioPath, context.outputDir, asyncJobOptions(context)),
  gladia: async context => await runGladiaStt(context.audioPath, context.outputDir, asyncJobOptions(context)),
  happyscribe: async context => await runHappyScribeStt(context.audioPath, context.outputDir, {
    ...basicOptions(context),
    happyscribeOrganizationId: context.options.happyscribeOrganizationId,
    runMode: context.options.runMode,
    lifecycle: context.options.asyncLifecycle
  }),
  supadata: async context => await runSupadataStt(context.audioPath, context.outputDir, {
    ...basicOptions(context),
    sourceUrl: context.options.sourceUrl,
    language: context.options.language,
    runMode: context.options.runMode,
    lifecycle: context.options.asyncLifecycle
  }),
  scrapecreators: async context => await runScrapeCreatorsStt(context.audioPath, context.outputDir, {
    ...minimalOptions(context),
    sourceUrl: context.options.sourceUrl,
    language: context.options.language
  }),
  'gemini-stt': async context => await runGeminiStt(context.audioPath, context.outputDir, basicOptions(context)),
  together: async context => await runTogetherStt(context.audioPath, context.outputDir, basicOptions(context)),
  'youtube-captions': async () => {
    throw InternalError('youtube-captions is resolved before STT provider dispatch', { stage: 'stt:dispatch' })
  }
} satisfies Record<SttTarget['service'], SttDispatcher>

export const dispatchStt = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: SttTargetOptions,
  segmentNumber?: number,
  totalSegments?: number,
  whisperProgress?: WhisperProgressWindow | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => await sttDispatchers[target.service]({
  target,
  audioPath,
  outputDir,
  segmentOffsetMinutes,
  options,
  segmentNumber,
  totalSegments,
  whisperProgress
})
