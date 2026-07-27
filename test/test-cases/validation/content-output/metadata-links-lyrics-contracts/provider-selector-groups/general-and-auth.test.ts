import { expect, test } from 'bun:test'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  BETTER_AUTH_ALL_LINKS,
  BETTER_AUTH_GENERAL_LINKS,
  DRIVE_GENERAL_LINKS,
  RUNWAY_ALL_LINKS,
  RUNWAY_GENERAL_LINKS,
  RUNWAY_MODELS_LINKS,
  SOLIDBASE_GENERAL_LINKS
} from './fixtures/index'

test('links selector accepts runway provider with general and models sections', async () => {
  const runwaySelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway'
  ])

  expect(runwaySelection.serviceSelections.get('runway')).toEqual([])
  expect(collectLinks(
    runwaySelection.serviceSelections,
    runwaySelection.globalSections
  )).toEqual(RUNWAY_ALL_LINKS)

  const runwayGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway',
    'general'
  ])

  expect(collectLinks(
    runwayGeneralSelection.serviceSelections,
    runwayGeneralSelection.globalSections
  )).toEqual(RUNWAY_GENERAL_LINKS)

  const runwayModelsSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway',
    'models'
  ])

  expect(collectLinks(
    runwayModelsSelection.serviceSelections,
    runwayModelsSelection.globalSections
  )).toEqual(RUNWAY_MODELS_LINKS)

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--runway',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --runway: tts')
})

test('links selector accepts better-auth provider with general section', async () => {
  const betterAuthSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth'
  ])

  expect(betterAuthSelection.serviceSelections.get('better-auth')).toEqual([])
  expect(collectLinks(
    betterAuthSelection.serviceSelections,
    betterAuthSelection.globalSections
  )).toEqual(BETTER_AUTH_ALL_LINKS)
  expect(getDefaultLinksOutputFileName(
    betterAuthSelection.serviceSelections,
    betterAuthSelection.globalSections
  )).toBe('better-auth-all-links.md')

  const betterAuthGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth',
    'general'
  ])

  expect(collectLinks(
    betterAuthGeneralSelection.serviceSelections,
    betterAuthGeneralSelection.globalSections
  )).toEqual(BETTER_AUTH_GENERAL_LINKS)
  expect(getDefaultLinksOutputFileName(
    betterAuthGeneralSelection.serviceSelections,
    betterAuthGeneralSelection.globalSections
  )).toBe('better-auth-general-links.md')

  const globalGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'general'
  ])

  expect(collectLinks(
    globalGeneralSelection.serviceSelections,
    globalGeneralSelection.globalSections
  )).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))
  expect(collectLinks(new Map(), [])).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--better-auth',
    'tts'
  ])).rejects.toThrow('Unknown links section(s) for --better-auth: tts')
})

test('links selector accepts solidbase provider with general section', async () => {
  const solidbaseSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--solidbase'
  ])

  expect(solidbaseSelection.serviceSelections.get('solidbase')).toEqual([])
  expect(collectLinks(
    solidbaseSelection.serviceSelections,
    solidbaseSelection.globalSections
  )).toEqual(SOLIDBASE_GENERAL_LINKS)
  expect(getDefaultLinksOutputFileName(
    solidbaseSelection.serviceSelections,
    solidbaseSelection.globalSections
  )).toBe('solidbase-all-links.md')

  const solidbaseGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--solidbase',
    'general'
  ])

  expect(collectLinks(
    solidbaseGeneralSelection.serviceSelections,
    solidbaseGeneralSelection.globalSections
  )).toEqual(SOLIDBASE_GENERAL_LINKS)
  expect(getDefaultLinksOutputFileName(
    solidbaseGeneralSelection.serviceSelections,
    solidbaseGeneralSelection.globalSections
  )).toBe('solidbase-general-links.md')

  await expect(runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--solidbase',
    'image'
  ])).rejects.toThrow('Unknown links section(s) for --solidbase: image')
})

test('links selector accepts drive provider with general section', () => {
  const driveSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--drive'
  ])

  expect(driveSelection.serviceSelections.get('drive')).toEqual([])
  expect(collectLinks(
    driveSelection.serviceSelections,
    driveSelection.globalSections
  )).toEqual(DRIVE_GENERAL_LINKS)

  const driveGeneralSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--drive',
    'general'
  ])

  expect(collectLinks(
    driveGeneralSelection.serviceSelections,
    driveGeneralSelection.globalSections
  )).toEqual(DRIVE_GENERAL_LINKS)
})
