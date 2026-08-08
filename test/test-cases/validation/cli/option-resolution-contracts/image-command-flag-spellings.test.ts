import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { imageCommandFlags, imageCommandOptionNames } from '~/cli/flags/image-flags'
import { renameFlagSpellings } from '~/cli/flags/flag-utils'

const internalNames = Object.keys(imageCommandOptionNames)
const publicNames = Object.values(imageCommandOptionNames)

const messageFor = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected the image target collector to reject these options')
}

describe('image command flag spellings', () => {
  // Both directions: a flag the standalone command renames must be registered under its short
  // name only, so the rename map and the registered flag set cannot drift apart.
  test('the standalone image command registers the renamed spellings and none of the pipeline ones', () => {
    const registered = Object.keys(imageCommandFlags)
    expect(publicNames.filter((name) => !registered.includes(name))).toEqual([])
    expect(internalNames.filter((name) => registered.includes(name))).toEqual([])
  })

  // The retarget is a `replaceAll` over the map, so a key that is a prefix of another key would
  // rewrite it into a spelling nobody registers. Round-tripping every key catches that.
  test('every internal spelling retargets to exactly its public spelling', () => {
    expect(renameFlagSpellings(internalNames.map((name) => `--${name}`).join(' '), imageCommandOptionNames))
      .toBe(publicNames.map((name) => `--${name}`).join(' '))
  })

  // Step-5 validators are shared with write/config/resume and name the `--image-*` flags. The
  // standalone command retargets their usage errors, so a rejection names a flag it accepts.
  test('shared step-5 rejections retarget to the spellings the image command accepts', () => {
    const grokMessage = messageFor(() => collectImageTargets(buildOptsFromFlags(false, {
      'grok-image': 'grok-imagine-image-quality',
      'image-search-grounding': true
    })))
    expect(grokMessage).toContain('--image-search-grounding')
    const retargetedGrok = renameFlagSpellings(grokMessage, imageCommandOptionNames)
    expect(retargetedGrok).toContain('--search-grounding is not supported by Grok/grok-imagine-image-quality')
    expect(retargetedGrok).not.toContain('--image-')

    const recraftMessage = messageFor(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-format': 'webp',
      'image-input': ['reference.png']
    })))
    const retargetedRecraft = renameFlagSpellings(recraftMessage, imageCommandOptionNames)
    expect(retargetedRecraft).toContain('--format, --input are not supported by Recraft/recraftv4_1')
    expect(retargetedRecraft).not.toContain('--image-')
  })
})
