import { validateWhisperfileModel } from './stt-models'
import { downloadWhisperfileBinary } from '~/cli/commands/stt/local/whisperfile/whisperfile'
import { UsageError } from '~/utils/error-handler'

export const resolveSetupModel = (selector: string): string => {
  const trimmed = selector.trim()
  const separator = trimmed.indexOf(':')
  if (separator < 0) return validateWhisperfileModel(trimmed)
  if (trimmed.slice(0, separator) !== 'whisperfile') throw UsageError(`Unknown model prefix "${trimmed.slice(0, separator)}". Expected whisperfile:<model>.`)
  return validateWhisperfileModel(trimmed.slice(separator + 1).trim())
}

export const runModelDownloads = async (models: readonly string[]): Promise<void> => {
  const selected = [...new Set(models.map(resolveSetupModel))]
  for (const model of selected) await downloadWhisperfileBinary(model)
}
