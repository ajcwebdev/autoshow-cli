import { expect, test } from 'bun:test'
import { expectLinksUsageError } from '../links-usage-errors'
import {
  collectLinks,
  parseLinksArgv,
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  FIRECRAWL_URL_LINKS,
  GLM_OCR_LINKS,
  GLM_MODELS_LINKS,
  GLM_URL_LINKS,
  KIMI_ALL_LINKS,
  KIMI_MODELS_LINKS,
  KIMI_OCR_LINKS,
  KIMI_TEXT_LINKS,
  SCRAPECREATORS_URL_LINKS,
  SPIDER_URL_LINKS,
  SUPADATA_URL_LINKS,
  X_URL_LINKS,
  ZYTE_URL_LINKS
} from './fixtures/index'

test('links selector accepts glm provider with separate ocr and url sections', () => {
  const glmOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--glm',
    'ocr'
  ])

  expect(collectLinks(
    glmOcrSelection.serviceSelections,
    glmOcrSelection.globalSections
  )).toEqual(GLM_OCR_LINKS)

  const glmModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--glm',
    'models'
  ])

  expect(collectLinks(
    glmModelsSelection.serviceSelections,
    glmModelsSelection.globalSections
  )).toEqual(GLM_MODELS_LINKS)

  const glmUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--glm',
    'url'
  ])

  expect(collectLinks(
    glmUrlSelection.serviceSelections,
    glmUrlSelection.globalSections
  )).toEqual(GLM_URL_LINKS)

  const globalUrlSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'url'
  ])

  expect(collectLinks(
    globalUrlSelection.serviceSelections,
    globalUrlSelection.globalSections
  )).toEqual([
    ...GLM_URL_LINKS,
    ...X_URL_LINKS,
    ...SUPADATA_URL_LINKS,
    ...SCRAPECREATORS_URL_LINKS,
    ...ZYTE_URL_LINKS,
    ...FIRECRAWL_URL_LINKS,
    ...SPIDER_URL_LINKS
  ])
})


test('links selector accepts kimi provider with general text and ocr sections', async () => {
  const kimiSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi'
  ])

  expect(kimiSelection.serviceSelections.get('kimi')).toEqual([])
  expect(collectLinks(
    kimiSelection.serviceSelections,
    kimiSelection.globalSections
  )).toEqual(KIMI_ALL_LINKS)

  const kimiModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'models'
  ])

  expect(collectLinks(
    kimiModelsSelection.serviceSelections,
    kimiModelsSelection.globalSections
  )).toEqual(KIMI_MODELS_LINKS)

  const kimiTextSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'text'
  ])

  expect(collectLinks(
    kimiTextSelection.serviceSelections,
    kimiTextSelection.globalSections
  )).toEqual(KIMI_TEXT_LINKS)

  const kimiOcrSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'ocr'
  ])

  expect(collectLinks(
    kimiOcrSelection.serviceSelections,
    kimiOcrSelection.globalSections
  )).toEqual(KIMI_OCR_LINKS)

  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--kimi',
    'tts'
  ], 'Unknown links section(s) for --kimi: tts')
})
