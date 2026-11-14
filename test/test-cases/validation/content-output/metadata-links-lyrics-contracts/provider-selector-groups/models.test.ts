import { expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { expectLinksUsageError } from '../links-usage-errors'
import { linksTestOutputPath } from '../shared'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
  runLinksWithArgv,
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  ALL_MODELS_LINKS,
  GEMINI_MODELS_LINKS,
  GROK_MODELS_LINKS,
  OPENAI_MODELS_LINKS,
} from './fixtures/index'

const speechModelReferences = [
  ['deepgram', [
    'https://developers.deepgram.com/docs/model.md',
    'https://developers.deepgram.com/docs/models-languages-overview.md'
  ]],
  ['speechmatics', [
    'https://docs.speechmatics.com/speech-to-text/models.md'
  ]],
  ['soniox', [
    'https://soniox.com/docs/api-reference/stt/get_models.mdx',
    'https://soniox.com/docs/stt/models',
    'https://soniox.com/docs/tts/models.mdx',
    'https://soniox.com/docs/api-reference/tts/get_tts_models.mdx'
  ]]
] as const

for (const [provider, modelReferences] of speechModelReferences) {
  test(`links --provider ${provider} models fetches its model catalogs without modality usage guides`, async () => {
    const outputPath = linksTestOutputPath(`${provider}-models`)
    const fetched: string[] = []
    try {
      const result = await runLinksWithArgv([
        'bun', 'src/cli/create-cli.ts', 'links', '--provider', provider, 'models'
      ], {
        outputPath,
        fetchImpl: async (input) => {
          fetched.push(String(input))
          return new Response(`# model reference for ${String(input)}\n`, {
            headers: { 'content-type': 'text/markdown' }
          })
        }
      })
      expect(fetched).toEqual([...modelReferences])
      expect(result.urlCount).toBe(modelReferences.length)
      const bundle = await Bun.file(outputPath).text()
      for (const url of modelReferences) {
        expect(bundle).toContain(`<!-- Source: ${url} -->`)
      }
    } finally {
      await rm(outputPath, { force: true })
    }
  })
}

test('links selector accepts global models section in provider order', () => {
  const selection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'models'
  ])

  expect(selection.globalSections).toEqual(['models'])
  expect(collectLinks(
    selection.serviceSelections,
    selection.globalSections
  )).toEqual(ALL_MODELS_LINKS)
  expect(getDefaultLinksOutputFileName(
    selection.serviceSelections,
    selection.globalSections
  )).toBe('all-models-links.md')
})

test('links selector accepts provider-scoped models sections', () => {
  const cases = [
    ['openai', OPENAI_MODELS_LINKS],
    ['gemini', GEMINI_MODELS_LINKS],
    ['grok', GROK_MODELS_LINKS],
  ] as const

  for (const [provider, expectedLinks] of cases) {
    const selection = parseLinksArgv([
      'bun',
      'src/cli/create-cli.ts',
      'links',
      '--provider',
      provider,
      'models'
    ])

    expect(collectLinks(
      selection.serviceSelections,
      selection.globalSections
    )).toEqual(expectedLinks)
    expect(getDefaultLinksOutputFileName(
      selection.serviceSelections,
      selection.globalSections
    )).toBe(`${provider}-models-links.md`)
  }
})

test('links selector rejects provider-scoped models section when provider has none', async () => {
  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--provider', 'spider',
    'models'
  ], 'Unknown links section(s) for --provider spider: models')
})
