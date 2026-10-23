import { expect, test } from 'bun:test'
import { collectLinks, parseLinksArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  FAL_IMAGE_LINKS,
  FAL_VIDEO_LINKS,
} from './fixtures/index'

test('links selector accepts separate fal image and video sections', () => {
  const imageSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'fal', 'image'])
  expect(collectLinks(imageSelection.serviceSelections, imageSelection.globalSections)).toEqual(FAL_IMAGE_LINKS)
  const videoSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'fal', 'video'])
  expect(collectLinks(videoSelection.serviceSelections, videoSelection.globalSections)).toEqual(FAL_VIDEO_LINKS)
})
