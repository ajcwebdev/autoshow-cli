import type { CliFlagOccurrence } from '~/types'
import { AppError } from '~/utils/error-handler'

const reject = (message: string): never => { throw new AppError(`Image-model policy: ${message}`, { kind: 'validation', stage: 'image:policy', exitCode: 64 }) }

export const assertRequiredImageModel = (model: unknown, service?: string): void => {
  const required = process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  if (required && (model !== required || (service !== undefined && service !== 'openai'))) reject(`requires openai=${required}; received ${service ?? 'image'}=${String(model)}`)
}

// Every image-producing command now selects its target with --provider, so one occurrence check
// covers them all. The command list stays explicit rather than derived: `comic character-sketch`
// registers no flags of its own and must keep failing closed.
const IMAGE_PRODUCING_COMMANDS = ['image', 'comic generate-images', 'comic reference-sketch', 'comic character-sketch']

export const enforceImageCommandPolicy = (command: string, flags: Record<string, unknown>, occurrences: readonly CliFlagOccurrence[]): void => {
  const required = process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  if (!required) return
  // Evaluated before the occurrence check: a QA-only run legitimately passes no --provider.
  if (command === 'comic generate-images' && flags['qa-only'] === true) return
  if (!IMAGE_PRODUCING_COMMANDS.includes(command)) return

  const providers = occurrences.filter(flag => flag.name === 'provider')
  if (
    providers.length !== 1
    || providers[0]?.value !== `openai=${required}`
    || flags['all-providers'] === true
    || flags['all-image'] === true
  ) {
    reject(`image generation requires exactly --provider openai=${required}`)
  }
}
