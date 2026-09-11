import type { CliCommandContext, ComicRecoveryFlags, ComicRecoveryStage, ResumeTarget } from '~/types'
import { configurePinnedRunDir, getPinnedRunDir, resetPinnedRunDir } from '../../../command-shared/run-dir'
import { configureCharactersRoot, getCharactersRoot } from '../../../command-shared/characters-root'
import { resetSceneRunContext } from '../../../visuals/comic/comic-utils/scene-run-context'
import { generateImagesCommandDefinition, generateAudioCommandDefinition, generateSlideshowCommandDefinition } from '../../../visuals/comic/comic-utils/subcommand-help'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'

export const definitions = { image: generateImagesCommandDefinition, audio: generateAudioCommandDefinition, presentation: generateSlideshowCommandDefinition }
export const stageOrder = ['image', 'audio', 'presentation'] as const
export const recoveryContext = (stage: ComicRecoveryStage, scriptPath: string, recordedFlags: ComicRecoveryFlags, price: boolean, allowAmbiguousRedispatch: boolean): CliCommandContext => {
  const definition = definitions[stage]
  const flags = { ...recordedFlags, price, ...(stage === 'audio' ? { 'allow-ambiguous-redispatch': allowAmbiguousRedispatch } : {}) }
  const args = [definition.name, scriptPath]
  for (const [key, value] of Object.entries(flags)) {
    if (Array.isArray(value)) for (const item of value) args.push(`--${key}`, item)
    else if (typeof value === 'boolean') args.push(`--${key}=${value}`)
    else args.push(`--${key}`, value)
  }
  const parsed = parseCommandInvocation(args, definition, GLOBAL_FLAG_DEFINITIONS)
  return { argv: args, command: definition, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: { comicResume: true } }
}

export const inComicWorkspace = async <T>(target: ResumeTarget, run: () => Promise<T>): Promise<T> => {
  const previousPin = getPinnedRunDir()
  const previousCharacters = getCharactersRoot()
  configurePinnedRunDir(target.dir)
  resetSceneRunContext()
  try { return await run() }
  finally {
    resetSceneRunContext()
    resetPinnedRunDir()
    if (previousPin) configurePinnedRunDir(previousPin)
    configureCharactersRoot(previousCharacters)
  }
}
