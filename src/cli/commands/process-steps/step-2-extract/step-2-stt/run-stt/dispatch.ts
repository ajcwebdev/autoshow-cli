import type { Step2Metadata, SttTarget, SttTargetOptions, TranscriptionResult, WhisperProgressWindow } from '~/types'
import { assertNever } from '~/utils/validate/assert-never'
import { InternalError } from '~/utils/error-handler'
import { ensureSttTargetSetup as ensureSttTargetSetupViaBroker } from '../bootstrap'
import { runReverbTranscribe } from '../stt-local/reverb/run-reverb'
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
import { runRevStt } from '../stt-services/rev/run-rev-stt'
import { runScrapeCreatorsStt } from '../stt-services/scrapecreators/run-scrapecreators-stt'
import { runSonioxStt } from '../stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from '../stt-services/speechmatics/run-speechmatics-stt'
import { runSupadataStt } from '../stt-services/stt-supadata/run-supadata-stt'
import { runTogetherStt } from '../stt-services/together/run-together-stt'


export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> =>
  await ensureSttTargetSetupViaBroker(target)

export const dispatchStt = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: SttTargetOptions,
  segmentNumber?: number,
  totalSegments?: number,
  whisperProgress?: WhisperProgressWindow | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'reverb') {
    return await runReverbTranscribe(audioPath, outputDir, {
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      reverbVerbatimicity: options.reverbVerbatimicity
    })
  }

  if (target.service === 'deepgram') {
    return await runDeepgramTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'deepinfra') {
    return await runDeepinfraTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'soniox') {
    return await runSonioxStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'speechmatics') {
    return await runSpeechmaticsStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'rev') {
    return await runRevStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'groq') {
    return await runGroqTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'grok') {
    return await runGrokStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'whisper') {
    return await runWhisperTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (target.service === 'whisperfile') {
    return await runWhisperfileTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (target.service === 'mistral') {
    return await runMistralStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      passController: options.mistralPassController
    })
  }

  if (target.service === 'assemblyai') {
    return await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'gladia') {
    return await runGladiaStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'happyscribe') {
    return await runHappyScribeStt(audioPath, outputDir, {
      model: target.model,
      happyscribeOrganizationId: options.happyscribeOrganizationId,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'supadata') {
    return await runSupadataStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'scrapecreators') {
    return await runScrapeCreatorsStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'gemini-stt') {
    return await runGeminiStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'together') {
    return await runTogetherStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'youtube-captions') {
    throw InternalError('youtube-captions is resolved before STT provider dispatch', { stage: 'stt:dispatch' })
  }

  assertNever(target.service)
}
