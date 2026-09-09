import type { CliFlagOccurrence } from '~/types'
import { AppError } from '~/utils/error-handler'

const reject = (message: string): never => { throw new AppError(`Image-model policy: ${message}`, { kind: 'validation', stage: 'image:policy', exitCode: 64 }) }

export const assertRequiredImageModel = (model: unknown, service?: string): void => {
  const required = process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  if (required && (model !== required || (service !== undefined && service !== 'openai'))) reject(`requires openai=${required}; received ${service ?? 'image'}=${String(model)}`)
}

export const enforceImageCommandPolicy = (command: string, flags: Record<string, unknown>, occurrences: readonly CliFlagOccurrence[]): void => {
  const required = process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  if (!required) return
  if (command === 'comic generate-images' && flags['qa-only'] === true) return
  if (['comic generate-images', 'comic reference-sketch', 'comic character-sketch'].includes(command)) {
    const models = occurrences.filter(flag => flag.name === 'image-model')
    if (models.length !== 1 || models[0]?.value !== required) reject(`image-producing comic commands require exactly --image-model ${required}`)
  }
  if (command === 'image') {
    const providers = occurrences.filter(flag => flag.name === 'provider')
    if (!providers.length || providers.some(flag => flag.value !== `openai=${required}`) || flags['all-providers'] === true || flags['all-image'] === true) reject(`standalone image generation requires only --provider openai=${required}`)
  }
}
