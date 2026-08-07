import { expect, test } from 'bun:test'
import { expectLinksUsageError } from '../links-usage-errors'
import { collectLinks, parseLinksArgv} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  FIRECRAWL_GENERAL_LINKS,
  FIRECRAWL_URL_LINKS,
  SCRAPECREATORS_GENERAL_LINKS,
  SCRAPECREATORS_STT_LINKS,
  SCRAPECREATORS_URL_LINKS,
  SPIDER_GENERAL_LINKS,
  SPIDER_URL_LINKS,
  SUPADATA_GENERAL_LINKS,
  SUPADATA_STT_LINKS,
  SUPADATA_URL_LINKS,
  X_GENERAL_LINKS,
  X_URL_LINKS,
  ZYTE_GENERAL_LINKS,
  ZYTE_URL_LINKS
} from './fixtures/index'

test('links selector accepts x provider with general and url sections', () => {
  const xSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x'
  ])

  expect(xSelection.serviceSelections.get('x')).toEqual([])
  expect(collectLinks(
    xSelection.serviceSelections,
    xSelection.globalSections
  )).toEqual([...X_GENERAL_LINKS, ...X_URL_LINKS])

  const xGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x',
    'general'
  ])

  expect(collectLinks(
    xGeneralSelection.serviceSelections,
    xGeneralSelection.globalSections
  )).toEqual(X_GENERAL_LINKS)

  const xUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--x',
    'url'
  ])

  expect(collectLinks(
    xUrlSelection.serviceSelections,
    xUrlSelection.globalSections
  )).toEqual(X_URL_LINKS)
})

test('links selector accepts supadata provider with general stt and url sections', async () => {
  const supadataSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata'
  ])

  expect(supadataSelection.serviceSelections.get('supadata')).toEqual([])
  expect(collectLinks(
    supadataSelection.serviceSelections,
    supadataSelection.globalSections
  )).toEqual([
    ...SUPADATA_GENERAL_LINKS,
    ...SUPADATA_STT_LINKS,
    ...SUPADATA_URL_LINKS
  ])

  const supadataGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'general'
  ])

  expect(collectLinks(
    supadataGeneralSelection.serviceSelections,
    supadataGeneralSelection.globalSections
  )).toEqual(SUPADATA_GENERAL_LINKS)

  const supadataSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'stt'
  ])

  expect(collectLinks(
    supadataSttSelection.serviceSelections,
    supadataSttSelection.globalSections
  )).toEqual(SUPADATA_STT_LINKS)

  const supadataUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'url'
  ])

  expect(collectLinks(
    supadataUrlSelection.serviceSelections,
    supadataUrlSelection.globalSections
  )).toEqual(SUPADATA_URL_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--supadata',
    'tts'
  ], 'Unknown links section(s) for --supadata: tts')
})

test('links selector accepts scrapecreators provider with general stt and url sections', async () => {
  const scrapecreatorsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators'
  ])

  expect(scrapecreatorsSelection.serviceSelections.get('scrapecreators')).toEqual([])
  expect(collectLinks(
    scrapecreatorsSelection.serviceSelections,
    scrapecreatorsSelection.globalSections
  )).toEqual([...SCRAPECREATORS_GENERAL_LINKS, ...SCRAPECREATORS_STT_LINKS, ...SCRAPECREATORS_URL_LINKS])

  const scrapecreatorsGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'general'
  ])

  expect(collectLinks(
    scrapecreatorsGeneralSelection.serviceSelections,
    scrapecreatorsGeneralSelection.globalSections
  )).toEqual(SCRAPECREATORS_GENERAL_LINKS)

  const scrapecreatorsSttSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'stt'
  ])

  expect(collectLinks(
    scrapecreatorsSttSelection.serviceSelections,
    scrapecreatorsSttSelection.globalSections
  )).toEqual(SCRAPECREATORS_STT_LINKS)

  const scrapecreatorsUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'url'
  ])

  expect(collectLinks(
    scrapecreatorsUrlSelection.serviceSelections,
    scrapecreatorsUrlSelection.globalSections
  )).toEqual(SCRAPECREATORS_URL_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--scrapecreators',
    'tts'
  ], 'Unknown links section(s) for --scrapecreators: tts')
})

test('links selector accepts zyte provider with general and url sections', async () => {
  const zyteSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte'
  ])

  expect(zyteSelection.serviceSelections.get('zyte')).toEqual([])
  expect(collectLinks(
    zyteSelection.serviceSelections,
    zyteSelection.globalSections
  )).toEqual([...ZYTE_GENERAL_LINKS, ...ZYTE_URL_LINKS])

  const zyteGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'general'
  ])

  expect(collectLinks(
    zyteGeneralSelection.serviceSelections,
    zyteGeneralSelection.globalSections
  )).toEqual(ZYTE_GENERAL_LINKS)

  const zyteUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'url'
  ])

  expect(collectLinks(
    zyteUrlSelection.serviceSelections,
    zyteUrlSelection.globalSections
  )).toEqual(ZYTE_URL_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--zyte',
    'tts'
  ], 'Unknown links section(s) for --zyte: tts')
})

test('links selector accepts firecrawl provider with general and url sections', async () => {
  const firecrawlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl'
  ])

  expect(firecrawlSelection.serviceSelections.get('firecrawl')).toEqual([])
  expect(collectLinks(
    firecrawlSelection.serviceSelections,
    firecrawlSelection.globalSections
  )).toEqual([...FIRECRAWL_GENERAL_LINKS, ...FIRECRAWL_URL_LINKS])

  const firecrawlGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'general'
  ])

  expect(collectLinks(
    firecrawlGeneralSelection.serviceSelections,
    firecrawlGeneralSelection.globalSections
  )).toEqual(FIRECRAWL_GENERAL_LINKS)

  const firecrawlUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'url'
  ])

  expect(collectLinks(
    firecrawlUrlSelection.serviceSelections,
    firecrawlUrlSelection.globalSections
  )).toEqual(FIRECRAWL_URL_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--firecrawl',
    'tts'
  ], 'Unknown links section(s) for --firecrawl: tts')
})

test('links selector accepts spider provider with general and url sections', async () => {
  const spiderSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider'
  ])

  expect(spiderSelection.serviceSelections.get('spider')).toEqual([])
  expect(collectLinks(
    spiderSelection.serviceSelections,
    spiderSelection.globalSections
  )).toEqual([...SPIDER_GENERAL_LINKS, ...SPIDER_URL_LINKS])

  const spiderGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'general'
  ])

  expect(collectLinks(
    spiderGeneralSelection.serviceSelections,
    spiderGeneralSelection.globalSections
  )).toEqual(SPIDER_GENERAL_LINKS)

  const spiderUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'url'
  ])

  expect(collectLinks(
    spiderUrlSelection.serviceSelections,
    spiderUrlSelection.globalSections
  )).toEqual(SPIDER_URL_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--spider',
    'tts'
  ], 'Unknown links section(s) for --spider: tts')
})
