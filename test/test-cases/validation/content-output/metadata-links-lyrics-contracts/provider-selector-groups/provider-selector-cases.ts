import { expect, test } from 'bun:test'
import type { ProviderSelectorCase, SelectorExpectation } from '~/types'
import {
  collectLinks,
  getDefaultLinksOutputFileName,
  parseLinksArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { expectLinksUsageError } from '../links-usage-errors'

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
