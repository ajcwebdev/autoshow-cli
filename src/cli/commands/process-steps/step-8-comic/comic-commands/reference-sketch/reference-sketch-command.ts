import type { ReferenceSketchCommandOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { characterSketchCommand } from '../character-sketch/character-sketch-command'
import { locationReferenceSketchCommand } from './location-reference-command'

export const referenceSketchCommand = async (options: ReferenceSketchCommandOptions): Promise<void> => {
  if (Number(Boolean(options.character)) + Number(Boolean(options.location)) !== 1) throw CLIUsageError('Exactly one of --character or --location is required')
  if (options.character) {
    if (options.view) throw CLIUsageError('--view is only valid with --location')
    await characterSketchCommand({
      character: options.character,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.revise !== undefined ? { revise: options.revise } : {}),
      ...(options.notes ? { notes: options.notes } : {}),
      ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
    })
    return
  }
  await locationReferenceSketchCommand(options)
}
