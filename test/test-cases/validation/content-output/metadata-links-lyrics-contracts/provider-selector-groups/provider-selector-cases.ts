import { expect, test } from 'bun:test'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { expectLinksUsageError } from '../links-usage-errors'

type SelectorExpectation = {
  sections: readonly string[]
  expected: string[]
  outputFileName?: string | undefined
}

type ProviderSelectorCase = {
  name: string
  provider: string
  all?: { expected: string[], outputFileName?: string | undefined } | undefined
  selections: readonly SelectorExpectation[]
  invalid?: { sections: readonly string[], message: string } | undefined
  additionalAssertions?: (() => Promise<void> | void) | undefined
}

const parseProviderSelection = (provider: string, sections: readonly string[]) => parseLinksArgv([
  'bun',
  'src/cli/create-cli.ts',
  'links',
  `--${provider}`,
  ...sections
])

const expectSelection = (provider: string, selection: SelectorExpectation): void => {
  const parsed = parseProviderSelection(provider, selection.sections)
  expect(collectLinks(parsed.serviceSelections, parsed.globalSections)).toEqual(selection.expected)
  if (selection.outputFileName !== undefined) {
    expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe(selection.outputFileName)
  }
}

export const registerProviderSelectorCases = (cases: readonly ProviderSelectorCase[]): void => {
  for (const providerCase of cases) {
    test(providerCase.name, async () => {
      if (providerCase.all) {
        const parsed = parseProviderSelection(providerCase.provider, [])
        expect(parsed.serviceSelections.get(providerCase.provider)).toEqual([])
        expect(collectLinks(parsed.serviceSelections, parsed.globalSections)).toEqual(providerCase.all.expected)
        if (providerCase.all.outputFileName !== undefined) {
          expect(getDefaultLinksOutputFileName(parsed.serviceSelections, parsed.globalSections)).toBe(providerCase.all.outputFileName)
        }
      }
      for (const selection of providerCase.selections) expectSelection(providerCase.provider, selection)
      if (providerCase.invalid) {
        await expectLinksUsageError([
          'bun',
          'src/cli/create-cli.ts',
          'links',
          `--${providerCase.provider}`,
          ...providerCase.invalid.sections
        ], providerCase.invalid.message)
      }
      await providerCase.additionalAssertions?.()
    })
  }
}
