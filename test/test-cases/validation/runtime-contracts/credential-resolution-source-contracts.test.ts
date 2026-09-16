import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { GENERATION_SELECTION_ENTRIES } from '~/cli/commands/command-shared/generation-routing/generation-selection-entries'
import { HOSTED_OCR_ADAPTERS } from '~/cli/commands/text/ocr/hosted-ocr-adapters'
import { describeSourceVocabularyViolations, scanSourceVocabulary } from './source-vocabulary-scanner'

/**
 * Setup helpers that provision a local binary rather than wrap a credential. Anything else matching
 * `ensure*Setup` is the shim shape Phase 4 retired into registry and descriptor fields.
 */
const LOCAL_TOOL_SETUP_FILES = new Set([
  'src/cli/commands/text/ocr/ocr-utils/tesseract-utils.ts',
  'src/cli/commands/text/url/url-local/defuddle/defuddle-cli.ts',
  'src/cli/commands/stt/bootstrap.ts'
])

describe('credential resolution source contracts', () => {
  test('no provider re-introduces a per-provider ensure*Setup credential shim', async () => {
    const violations = await scanSourceVocabulary(/export const ensure\w*Setup\b/, LOCAL_TOOL_SETUP_FILES)
    expect(describeSourceVocabularyViolations(violations)).toEqual([])
  })

  test('generation adapters read their key from the registry rather than resolving it inline', async () => {
    const generationRoots = [
      'src/cli/commands/visuals/image/image-generation-services',
      'src/cli/commands/visuals/video/video-services',
      'src/cli/commands/audio/music/music-services'
    ]
    const violations = (await scanSourceVocabulary(/resolveCredential\(/, new Set()))
      .filter(violation => generationRoots.some(root => violation.file.startsWith(root)))
    expect(describeSourceVocabularyViolations(violations)).toEqual([])
  })

  test('TTS adapters read their key through the shared registry-backed helper', async () => {
    const violations = (await scanSourceVocabulary(/resolveCredential\(/, new Set()))
      .filter(violation => violation.file.startsWith('src/cli/commands/audio/tts/tts-services/'))
      // These resolve an operation-specific credential (an override value or a non-TTS stage),
      // not the provider key a `run-*-tts.ts` needs.
      .filter(violation => !violation.text.includes('useProvidedValue')
        && !violation.text.includes('Text-to-Dialogue')
        && !violation.text.includes('native utterances'))
    expect(describeSourceVocabularyViolations(violations)).toEqual([])
  })

  test('every hosted OCR adapter carries the provider id and label its credential check needs', () => {
    for (const adapter of HOSTED_OCR_ADAPTERS) {
      expect(adapter.label, adapter.service).toMatch(/ OCR$/)
      expect(adapter.service.length, adapter.service).toBeGreaterThan(0)
    }
    const services = HOSTED_OCR_ADAPTERS.map(adapter => adapter.service)
    expect([...new Set(services)]).toEqual(services)
  })

  test('the OCR dispatcher resolves the credential once from the adapter descriptor', async () => {
    const source = await readFile(join(PROJECT_ROOT, 'src/cli/commands/text/ocr/hosted-ocr.ts'), 'utf8')
    expect(source).toContain("resolveCredential(adapter.service, 'require', { stage: `ocr:${adapter.service}`, description: adapter.label })")
  })

  test('every generation selection entry carries a credential description', () => {
    for (const entry of GENERATION_SELECTION_ENTRIES) {
      expect(entry.credentialDescription, entry.flagName).toMatch(/ (image|video|music) generation$/)
    }
  })
})
