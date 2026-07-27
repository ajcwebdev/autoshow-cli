import { SUPPORTED_WHISPER_MODELS, validateWhisperModel, validateWhisperfileModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { downloadWhisperModel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/bootstrap'
import { downloadWhisperfileBinary } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import { ensureLlamafileBundleDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-download'
import * as l from '~/utils/app-logger/app-logger'

const downloadWhisper = async (model: string): Promise<void> => {
  const whisperModel = validateWhisperModel(model)
  l.write('info', `Downloading whisper model: ${whisperModel}`)
  await downloadWhisperModel(whisperModel)
  l.write('success', `Download complete: ${whisperModel}`)
}

const downloadWhisperfile = async (model: string): Promise<void> => {
  const whisperfileModel = validateWhisperfileModel(model)
  l.write('info', `Downloading whisperfile model: ${whisperfileModel}`)
  await downloadWhisperfileBinary(whisperfileModel)
  l.write('success', `Download complete: whisperfile:${whisperfileModel}`)
}

const downloadLlama = async (model: string): Promise<void> => {
  l.write('info', `Downloading llama model: ${model}`)
  await ensureLlamaModelDownloaded(model)
  l.write('success', `Download complete: ${model}`)
}

const downloadLlamafile = async (model: string): Promise<void> => {
  l.write('info', `Downloading llamafile bundle: ${model}`)
  // ensureLlamafileBundleDownloaded validates against the known bundle list.
  await ensureLlamafileBundleDownloaded(model)
  l.write('success', `Download complete: llamafile:${model}`)
}

// `provider:model` selectors route explicitly. The `whisperfile:`/`llamafile:` prefixes
// disambiguate from `whisper`/`llama` whose model names overlap (e.g. `tiny`, `small`).
const runModelDownload = async (model: string): Promise<void> => {
  const trimmed = model.trim()
  const separatorIndex = trimmed.indexOf(':')
  if (separatorIndex > 0) {
    const prefix = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1).trim()
    switch (prefix) {
      case 'whisper': await downloadWhisper(value); return
      case 'whisperfile': await downloadWhisperfile(value); return
      case 'llama': await downloadLlama(value); return
      case 'llamafile': await downloadLlamafile(value); return
      // Unknown prefix falls through to legacy resolution (e.g. Hugging Face repo ids
      // such as `ggml-org/Qwen3-0.6B-GGUF` contain no `:`, so this only catches a real
      // unrecognized prefix and treats the whole string as a llama target).
      default: break
    }
  }

  const isWhisperModel = SUPPORTED_WHISPER_MODELS.includes(trimmed as typeof SUPPORTED_WHISPER_MODELS[number])
  if (isWhisperModel) {
    await downloadWhisper(trimmed)
    return
  }

  await downloadLlama(trimmed)
}

export const runModelDownloads = async (models: readonly string[]): Promise<void> => {
  for (const model of models) {
    await runModelDownload(model)
  }
}
