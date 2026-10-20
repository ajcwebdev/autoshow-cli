import { expect, test } from 'bun:test'
import { collectLinks, parseLinksArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { SPIDER_URL_LINKS, X_URL_LINKS, ZYTE_URL_LINKS } from './fixtures/index'

test('removed Kimi and GLM links providers reject instead of exposing inactive catalogs', () => {
  for (const provider of ['kimi', 'glm']) for (const section of [undefined, 'models', 'text', 'ocr']) {
    expect(() => parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', provider, ...(section ? [section] : [])])).toThrow()
  }
})

test('global URL links include only the retained provider sections', () => {
  const selection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', 'url'])
  expect(collectLinks(selection.serviceSelections, selection.globalSections)).toEqual([...X_URL_LINKS, ...ZYTE_URL_LINKS, ...SPIDER_URL_LINKS])
})
