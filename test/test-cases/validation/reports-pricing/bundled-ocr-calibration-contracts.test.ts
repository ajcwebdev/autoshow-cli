import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { resolveHostedOcrTokenUsageEstimate } from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-token-profiles'
import calibration from '~/cli/commands/setup-and-utilities/models/ocr-calibration-profiles.json'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('bundled OCR calibration applies only to exact image/page/policy context and preserves other components', async () => {
  await withTempDir('autoshow-bundled-ocr-calibration-', async dir => {
    const base = { provider: 'gemini' as const, model: 'gemini-3.8-flash', pageCount: 1, ocrMode: 'image',
      profilePath: join(dir, 'missing.json'), effectiveReasoningEffort: 'low' as const,
      registryPromptTokensPerPage: 1157, registryCompletionTokensPerPage: 1626 }
    const estimate = resolveHostedOcrTokenUsageEstimate(base)
    expect(estimate.tokenEstimateSource).toBe('calibrated-registry')
    expect(estimate.promptTokens).toBe(1157) // No bundled prompt component for this context.
    expect(estimate.completionTokens).toBe(340)
    for (const override of [{ ocrMode: 'pdf' }, { pageCount: 2 }, { effectiveReasoningEffort: 'medium' as const }]) {
      expect(resolveHostedOcrTokenUsageEstimate({ ...base, ...override }).tokenEstimateSource).toBe('registry')
    }
    const keys = calibration.profiles.map(p => [p.provider, p.model, p.ocrMode, p.pageCountBand, p.effectiveReasoningEffort].join('/'))
    expect(new Set(keys).size).toBe(keys.length)
    expect(calibration.profiles.every(p => p.sampleCount >= 3)).toBe(true)
  })
})
