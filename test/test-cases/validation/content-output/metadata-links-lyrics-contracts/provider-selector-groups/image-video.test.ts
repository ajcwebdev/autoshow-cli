import { expect, test } from 'bun:test'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  BFL_ALL_LINKS,
  BFL_IMAGE_LINKS,
  BFL_MODELS_LINKS,
  LTX_ALL_LINKS,
  LTX_VIDEO_LINKS,
  LTX_MODELS_LINKS,
  RECRAFT_IMAGE_LINKS,
  REPLICATE_ALL_LINKS,
  REPLICATE_GENERAL_LINKS,
  REPLICATE_MODELS_LINKS
} from './fixtures/index'

test('links selector accepts bfl provider with models and image sections', async () => {
  const bflSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl'
  ])

  expect(bflSelection.serviceSelections.get('bfl')).toEqual([])
  expect(collectLinks(
    bflSelection.serviceSelections,
    bflSelection.globalSections
  )).toEqual(BFL_ALL_LINKS)

  const bflModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl',
    'models'
  ])

  expect(collectLinks(
    bflModelsSelection.serviceSelections,
    bflModelsSelection.globalSections
  )).toEqual(BFL_MODELS_LINKS)

  const bflImageSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl',
    'image'
  ])

  expect(collectLinks(
    bflImageSelection.serviceSelections,
    bflImageSelection.globalSections
  )).toEqual(BFL_IMAGE_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--bfl',
    'general'
  ])).rejects.toThrow('Unknown links section(s) for --bfl: general')
})

test('links selector accepts ltx provider with models and video sections', async () => {
  const ltxSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--ltx'
  ])

  expect(ltxSelection.serviceSelections.get('ltx')).toEqual([])
  expect(collectLinks(
    ltxSelection.serviceSelections,
    ltxSelection.globalSections
  )).toEqual(LTX_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    ltxSelection.serviceSelections,
    ltxSelection.globalSections
  )).toBe('ltx-all-links.md')

  const ltxVideoSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--ltx',
    'video'
  ])

  expect(collectLinks(
    ltxVideoSelection.serviceSelections,
    ltxVideoSelection.globalSections
  )).toEqual(LTX_VIDEO_LINKS)

  const ltxModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--ltx',
    'models'
  ])

  expect(collectLinks(
    ltxModelsSelection.serviceSelections,
    ltxModelsSelection.globalSections
  )).toEqual(LTX_MODELS_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--ltx',
    'image'
  ])).rejects.toThrow('Unknown links section(s) for --ltx: image')
})

test('links selector accepts recraft provider with only image section', async () => {
  const recraftSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--recraft'
  ])

  expect(recraftSelection.serviceSelections.get('recraft')).toEqual([])
  expect(collectLinks(
    recraftSelection.serviceSelections,
    recraftSelection.globalSections
  )).toEqual(RECRAFT_IMAGE_LINKS)
  expect(getDefaultLinksOutputFileName(
    recraftSelection.serviceSelections,
    recraftSelection.globalSections
  )).toBe('recraft-all-links.md')

  const recraftImageSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--recraft',
    'image'
  ])

  expect(collectLinks(
    recraftImageSelection.serviceSelections,
    recraftImageSelection.globalSections
  )).toEqual(RECRAFT_IMAGE_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--recraft',
    'video'
  ])).rejects.toThrow('Unknown links section(s) for --recraft: video')
})

test('links selector accepts replicate provider with general and models sections', async () => {
  const replicateSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--replicate'
  ])

  expect(replicateSelection.serviceSelections.get('replicate')).toEqual([])
  expect(collectLinks(
    replicateSelection.serviceSelections,
    replicateSelection.globalSections
  )).toEqual(REPLICATE_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    replicateSelection.serviceSelections,
    replicateSelection.globalSections
  )).toBe('replicate-all-links.md')

  const replicateGeneralModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--replicate',
    'general',
    'models'
  ])

  expect(collectLinks(
    replicateGeneralModelsSelection.serviceSelections,
    replicateGeneralModelsSelection.globalSections
  )).toEqual(REPLICATE_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    replicateGeneralModelsSelection.serviceSelections,
    replicateGeneralModelsSelection.globalSections
  )).toBe('replicate-general-models-links.md')

  const replicateModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--replicate',
    'models'
  ])

  expect(collectLinks(
    replicateModelsSelection.serviceSelections,
    replicateModelsSelection.globalSections
  )).toEqual(REPLICATE_MODELS_LINKS)

  const replicateGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--replicate',
    'general'
  ])

  expect(collectLinks(
    replicateGeneralSelection.serviceSelections,
    replicateGeneralSelection.globalSections
  )).toEqual(REPLICATE_GENERAL_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--replicate',
    'image'
  ])).rejects.toThrow('Unknown links section(s) for --replicate: image')
})
