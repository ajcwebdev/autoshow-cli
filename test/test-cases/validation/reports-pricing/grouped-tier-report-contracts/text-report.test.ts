import {
  describe,
  expect,
  test
} from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RankingSurfaceName, TtsRankingEntry } from '~/types'
import { expectTtsRankingSurfaces, runConsensusBuildReport, setupTempRoots } from './shared'
import { writeSingleManifestFixture } from '../../../../test-utils/manifest-helpers'

const makeTempRoot = setupTempRoots()

describe('grouped report contracts', () => {
  test('Text comparison report emits metadata ranking surfaces without provider APIs', async () => {
      const runDir = await makeTempRoot('autoshow-text-consensus-')
      await writeFile(join(runDir, 'openai-output.md'), 'OpenAI text output.\n')
      await writeFile(join(runDir, 'grok-output.md'), 'Grok text output.\n')
      await writeFile(join(runDir, 'anthropic-output.md'), 'Anthropic text output.\n')

      await writeSingleManifestFixture(runDir, 'write', {
          step3: [
            {
              llmService: 'openai',
              llmModel: 'gpt-6-luna',
              processingTime: 2400,
              inputTokenCount: 2000,
              outputTokenCount: 1000,
              tokenCountSource: 'provider',
              providerUsage: { prompt_tokens: 2000, completion_tokens: 1000 },
              outputFileName: 'openai-output.md'
            },
            {
              llmService: 'grok',
              llmModel: 'grok-4.7',
              processingTime: 6000,
              inputTokenCount: 10000,
              outputTokenCount: 2000,
              tokenCountSource: 'provider',
              providerUsage: { prompt_tokens: 10000, completion_tokens: 2000, total_tokens: 12000 },
              rawProviderUsage: { queue_time: 0.01 },
              outputFileName: 'grok-output.md'
            },
            {
              llmService: 'anthropic',
              llmModel: 'claude-haiku-5-5',
              processingTime: 2500,
              inputTokenCount: 3000,
              outputTokenCount: 500,
              tokenCountSource: 'provider',
              providerUsage: { total_tokens: 3500 },
              outputFileName: 'anthropic-output.md'
            }
          ],
          cost: {
            actual: {
              steps: [
                { step: 'llm', provider: 'openai', model: 'gpt-6-luna', cost: 0.4 },
                { step: 'llm', provider: 'grok', model: 'grok-4.7', cost: 1.2 },
                { step: 'llm', provider: 'anthropic', model: 'claude-haiku-5-5', cost: 3.6 }
              ]
            }
          },
          timing: {
            actual: {
              steps: [
                { step: 'llm', provider: 'openai', model: 'gpt-6-luna', processingTimeMs: 2400, msPerUnit: 800 },
                { step: 'llm', provider: 'grok', model: 'grok-4.7', processingTimeMs: 6000, msPerUnit: 300 },
                { step: 'llm', provider: 'anthropic', model: 'claude-haiku-5-5', processingTimeMs: 2500, msPerUnit: 700 }
              ]
            }
          }
      })

      const { stderr } = await runConsensusBuildReport('text', runDir)
      expect(stderr).toBe('')

      const report = await Bun.file(join(runDir, 'provider-comparison-report.json')).json() as {
        category: string
        providerGroups: {
          local: { count: number, providers: Array<{ providerKey: string, inputTokenCount: number, outputTokenCount: number, providerUsage: Record<string, unknown>, outputExists: boolean }> }
          service: { count: number, providers: Array<{ providerKey: string, inputTokenCount: number, outputTokenCount: number, providerUsage: Record<string, unknown>, rawProviderUsage: Record<string, unknown> | null }> }
        }
        rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]> & {
          automatedQualityUnavailableReason: string | null
          humanQualityUnavailableReason: string | null
        }>
      }

      expect(report.category).toBe('text')
      expectTtsRankingSurfaces(report)
      expect(report.providerGroups.local.count).toBe(0)
      expect(report.providerGroups.service.count).toBe(3)
      expect(report.providerGroups.local.providers).toEqual([])
      expect(report.providerGroups.service.providers.find((provider) => provider.providerKey === 'openai/gpt-6-luna')).toMatchObject({
        inputTokenCount: 2000,
        outputTokenCount: 1000,
        outputExists: true
      })
      expect(report.providerGroups.service.providers.find((provider) => provider.providerKey === 'grok/grok-4.7')).toMatchObject({
        inputTokenCount: 10000,
        outputTokenCount: 2000,
        providerUsage: { total_tokens: 12000 },
        rawProviderUsage: { queue_time: 0.01 }
      })
      expect(report.rankingSurfaces.local.price).toHaveLength(0)
      expect(report.rankingSurfaces.service.price.map((entry) => entry.providerKey)).toEqual([
        'openai/gpt-6-luna',
        'grok/grok-4.7',
        'anthropic/claude-haiku-5-5'
      ])
      expect(report.rankingSurfaces.service.speed.map((entry) => [entry.providerKey, entry.metric, entry.value])).toEqual([
        ['grok/grok-4.7', 'msPerUnit', 300],
        ['anthropic/claude-haiku-5-5', 'msPerUnit', 700],
        ['openai/gpt-6-luna', 'msPerUnit', 800]
      ])
      expect(report.rankingSurfaces.service.automatedQuality).toEqual([])
      expect(report.rankingSurfaces.service.humanQuality).toEqual([])
      expect(report.rankingSurfaces.service.automatedQualityUnavailableReason).toContain('schema validity')
      expect(report.rankingSurfaces.service.humanQualityUnavailableReason).toContain('humanQualityScore')

      const markdown = await Bun.file(join(runDir, 'provider-comparison-report.md')).text()
      expect(markdown).toContain('# Text Provider Comparison Report')
      expect(markdown).toContain('### Automated Quality')
      expect(markdown).toContain('300.000 ms/1K tokens')
      expect(markdown).toContain('Length, speed, cost, output existence, schema validity')
      expect(markdown).not.toContain('Top 3')
      expect(markdown).not.toContain('## Overall Ranking')
    })
})
