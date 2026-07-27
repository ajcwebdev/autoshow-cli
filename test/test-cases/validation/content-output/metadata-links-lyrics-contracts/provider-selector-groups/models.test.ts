import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
  runLinksWithArgv
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
  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'models'
  ])).rejects.toThrow('Unknown links section(s) for --firecrawl: models')
})

test('raw link manifests do not repeat URLs across categories', () => {
  const manifestsDir = 'src/cli/commands/setup-and-utilities/links/model-links'
  const seen = new Map<string, string>()
  const duplicates: string[] = []

  for (const fileName of readdirSync(manifestsDir).filter(file => file.endsWith('.json')).sort()) {
    const manifest = JSON.parse(readFileSync(join(manifestsDir, fileName), 'utf8')) as Record<string, Record<string, string[]>>
    for (const [providerName, sections] of Object.entries(manifest)) {
      for (const [sectionName, urls] of Object.entries(sections)) {
        for (const url of urls) {
          const owner = `${providerName}/${sectionName}`
          const previousOwner = seen.get(url)
          if (previousOwner) {
            duplicates.push(`${url} (${previousOwner}, ${owner})`)
          } else {
            seen.set(url, owner)
          }
        }
      }
    }
  }

  expect(duplicates).toEqual([])
})
