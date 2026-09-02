import { SUPPORTED_WHISPER_MODELS, validateWhisperModel, validateWhisperfileModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { downloadWhisperModel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/bootstrap'
import { downloadWhisperfileBinary } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import * as l from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'

const downloadWhisper = async (model: string): Promise<void> => {
  const whisperModel = validateWhisperModel(model)
  l.write('info', `Downloading whisper model: ${whisperModel}`, { category: 'command', metadata: { engine: 'whisper', model: whisperModel } })
  await downloadWhisperModel(whisperModel)
  l.write('info', `Download complete: ${whisperModel}`, { category: 'command', metadata: { engine: 'whisper', model: whisperModel } })
}

const downloadWhisperfile = async (model: string): Promise<void> => {
  const whisperfileModel = validateWhisperfileModel(model)
  l.write('info', `Downloading whisperfile model: ${whisperfileModel}`, { category: 'command', metadata: { engine: 'whisperfile', model: whisperfileModel } })
  await downloadWhisperfileBinary(whisperfileModel)
  l.write('info', `Download complete: whisperfile:${whisperfileModel}`, { category: 'command', metadata: { engine: 'whisperfile', model: whisperfileModel } })
}

const runModelDownload = async (model: string): Promise<void> => {
  const trimmed = model.trim()
  const separatorIndex = trimmed.indexOf(':')
  if (separatorIndex > 0) {
    const prefix = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1).trim()
    switch (prefix) {
      case 'whisper': await downloadWhisper(value); return
      case 'whisperfile': await downloadWhisperfile(value); return
      default:
        throw UsageError(`Unknown model prefix "${prefix}". Expected whisper:<model> or whisperfile:<model>.`)
    }
  }

  const isWhisperModel = SUPPORTED_WHISPER_MODELS.includes(trimmed as typeof SUPPORTED_WHISPER_MODELS[number])
  if (isWhisperModel) {
    await downloadWhisper(trimmed)
    return
  }

  throw UsageError(`Unknown local model "${trimmed}". Expected a Whisper model name or whisperfile:<model>.`)
}

export const runModelDownloads = async (models: readonly string[]): Promise<void> => {
  for (const model of models) {
    await runModelDownload(model)
  }
}
