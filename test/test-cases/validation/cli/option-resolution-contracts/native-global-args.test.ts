import { describe, expect, test } from 'bun:test'
import { configureOutputRoot, getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { getSceneOutputDirectory } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { normalizeWriteStepSelectorFlags } from '~/cli/flags/service-selector-normalization/step-selectors'
import { normalizeResumeSelectorFlagsForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'

describe('native global argument contracts', () => {
  test('comic output paths honor the configured output root and explicit output directories', () => {
    const originalOutputRoot = getOutputRoot()
    try {
      configureOutputRoot('/tmp/autoshow-comic-output-root-contract')
      resetSceneRunContext()
      expect(getSceneOutputDirectory('01-scene')).toStartWith('/tmp/autoshow-comic-output-root-contract/')

      resetSceneRunContext()
      expect(beginSceneRun('02-scene', { outputDir: '/tmp/autoshow-explicit-comic-run' }))
        .toBe('/tmp/autoshow-explicit-comic-run')
    } finally {
      configureOutputRoot(originalOutputRoot)
      resetSceneRunContext()
    }
  })

  test('unsupported local provider groups are rejected instead of silently dropped', () => {
    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['image']
    }, new Set(['all-local']), flagOccurrencesFromValues({ 'all-local': ['image'] }))).toThrow('Invalid --all-local step "image"')

    expect(() => normalizeGenericProviderSelectorFlags({
      'all-local': true
    }, new Set(['all-local']), flagOccurrencesFromValues({ 'all-local': true }), 'provider', STANDALONE_IMAGE_PROVIDER_TARGETS, {
      allProvidersTarget: 'all-image'
    })).toThrow('--all-local is not supported')

    expect(() => normalizeResumeSelectorFlagsForTarget({
      kind: 'video',
      scope: 'single',
      dir: '/tmp/video-run',
      manifestPath: '/tmp/video-run/manifest.json'
    }, { 'all-local': true }, new Set(['all-local']), flagOccurrencesFromValues({ 'all-local': true }))).toThrow('--all-local is not supported')
  })
})
