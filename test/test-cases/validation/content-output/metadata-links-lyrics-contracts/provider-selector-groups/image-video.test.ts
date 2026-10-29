import { expect, test } from 'bun:test'
import { collectLinks, parseLinksArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  GROK_IMAGE_LINKS,
  GROK_VIDEO_LINKS,
} from './fixtures/index'

test('links selector accepts separate image and video sections', () => {
  const imageSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'grok', 'image'])
  expect(collectLinks(imageSelection.serviceSelections, imageSelection.globalSections)).toEqual(GROK_IMAGE_LINKS)
  const videoSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'grok', 'video'])
  expect(collectLinks(videoSelection.serviceSelections, videoSelection.globalSections)).toEqual(GROK_VIDEO_LINKS)
})

test('removed fal links provider rejects instead of exposing an inactive catalog', () => {
  for (const section of [undefined, 'image', 'video']) {
    expect(() => parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'fal', ...(section ? [section] : [])])).toThrow()
  }
})
