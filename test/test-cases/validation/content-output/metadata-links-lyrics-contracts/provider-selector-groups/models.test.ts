import { expect, test } from 'bun:test'
import { expectLinksUsageError } from '../links-usage-errors'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  ALL_MODELS_LINKS,
  GEMINI_MODELS_LINKS,
  GROK_MODELS_LINKS,
  OPENAI_MODELS_LINKS,
  REPLICATE_MODELS_LINKS
} from './fixtures/index'

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
    ['replicate', REPLICATE_MODELS_LINKS]
  ] as const

  for (const [provider, expectedLinks] of cases) {
    const selection = parseLinksArgv([
      'bun',
      'src/cli/create-cli.ts',
      'links',
      `--${provider}`,
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
    '--firecrawl',
    'models'
  ], 'Unknown links section(s) for --firecrawl: models')
})
