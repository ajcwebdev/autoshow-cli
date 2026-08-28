import { expect } from 'bun:test'
import { collectLinks, parseLinksArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  BETTER_AUTH_ALL_LINKS,
  BETTER_AUTH_GENERAL_LINKS,
  DRIVE_GENERAL_LINKS,
  RUNWAY_ALL_LINKS,
  RUNWAY_GENERAL_LINKS,
  RUNWAY_MODELS_LINKS,
  SOLIDBASE_GENERAL_LINKS
} from './fixtures/index'
import { registerProviderSelectorCases } from './provider-selector-cases'

registerProviderSelectorCases([
  {
    name: 'links selector accepts runway provider with general and models sections',
    provider: 'runway',
    all: { expected: RUNWAY_ALL_LINKS },
    selections: [
      { sections: ['general'], expected: RUNWAY_GENERAL_LINKS },
      { sections: ['models'], expected: RUNWAY_MODELS_LINKS }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --runway: tts' }
  },
  {
    name: 'links selector accepts better-auth provider with general section',
    provider: 'better-auth',
    all: { expected: BETTER_AUTH_ALL_LINKS, outputFileName: 'better-auth-all-links.md' },
    selections: [
      { sections: ['general'], expected: BETTER_AUTH_GENERAL_LINKS, outputFileName: 'better-auth-general-links.md' }
    ],
    invalid: { sections: ['tts'], message: 'Unknown links section(s) for --better-auth: tts' },
    additionalAssertions: () => {
      const selection = parseLinksArgv(['bun', 'src/cli/create-cli.ts', 'links', 'general'])
      expect(collectLinks(selection.serviceSelections, selection.globalSections)).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))
      expect(collectLinks(new Map(), [])).toEqual(expect.arrayContaining(BETTER_AUTH_GENERAL_LINKS))
    }
  },
  {
    name: 'links selector accepts solidbase provider with general section',
    provider: 'solidbase',
    all: { expected: SOLIDBASE_GENERAL_LINKS, outputFileName: 'solidbase-all-links.md' },
    selections: [
      { sections: ['general'], expected: SOLIDBASE_GENERAL_LINKS, outputFileName: 'solidbase-general-links.md' }
    ],
    invalid: { sections: ['image'], message: 'Unknown links section(s) for --solidbase: image' }
  },
  {
    name: 'links selector accepts drive provider with general section',
    provider: 'drive',
    all: { expected: DRIVE_GENERAL_LINKS },
    selections: [{ sections: ['general'], expected: DRIVE_GENERAL_LINKS }]
  }
])
