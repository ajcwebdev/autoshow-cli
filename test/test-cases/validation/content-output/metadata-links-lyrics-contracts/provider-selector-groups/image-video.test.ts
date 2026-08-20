import { expect, test } from 'bun:test'
import { collectLinks, parseLinksArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  BFL_ALL_LINKS,
  BFL_IMAGE_LINKS,
  BFL_MODELS_LINKS,
  FAL_IMAGE_LINKS,
  FAL_VIDEO_LINKS,
  LTX_ALL_LINKS,
  LTX_MODELS_LINKS,
  LTX_VIDEO_LINKS,
  REPLICATE_ALL_LINKS,
  REPLICATE_GENERAL_LINKS,
  REPLICATE_MODELS_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

test('links selector accepts separate fal image and video sections', () => {
  const imageSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--fal', 'image'])
  expect(collectLinks(imageSelection.serviceSelections, imageSelection.globalSections)).toEqual(FAL_IMAGE_LINKS)
  const videoSelection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', '--fal', 'video'])
  expect(collectLinks(videoSelection.serviceSelections, videoSelection.globalSections)).toEqual(FAL_VIDEO_LINKS)
})

registerProviderSelectorCases([
  {
    name: 'links selector accepts bfl provider with models and image sections',
    provider: 'bfl',
    all: { expected: BFL_ALL_LINKS },
    selections: [
      { sections: ['models'], expected: BFL_MODELS_LINKS },
      { sections: ['image'], expected: BFL_IMAGE_LINKS }
    ],
    invalid: { sections: ['general'], message: 'Unknown links section(s) for --bfl: general' }
  },
  {
    name: 'links selector accepts ltx provider with models and video sections',
    provider: 'ltx',
    all: { expected: LTX_ALL_LINKS, outputFileName: 'ltx-all-links.md' },
    selections: [
      { sections: ['video'], expected: LTX_VIDEO_LINKS },
      { sections: ['models'], expected: LTX_MODELS_LINKS }
    ],
    invalid: { sections: ['image'], message: 'Unknown links section(s) for --ltx: image' }
  },
  {
    name: 'links selector accepts replicate provider with general and models sections',
    provider: 'replicate',
    all: { expected: REPLICATE_ALL_LINKS, outputFileName: 'replicate-all-links.md' },
    selections: [
      { sections: ['general', 'models'], expected: REPLICATE_ALL_LINKS, outputFileName: 'replicate-general-models-links.md' },
      { sections: ['models'], expected: REPLICATE_MODELS_LINKS },
      { sections: ['general'], expected: REPLICATE_GENERAL_LINKS }
    ],
    invalid: { sections: ['image'], message: 'Unknown links section(s) for --replicate: image' }
  }
])
