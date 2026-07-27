import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RankingSurfaceName, TtsRankingEntry } from '~/types'
import { expectTtsRankingSurfaces, runConsensusBuildReport, writeJson } from './shared'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('grouped report contracts', () => {
  test('Text comparison report emits metadata ranking surfaces without provider APIs', async () => {
      const runDir = await makeTempRoot('autoshow-text-consensus-')
      await writeFile(join(runDir, 'llama-output.md'), 'Local text output.\n')
      await writeFile(join(runDir, 'groq-output.md'), 'Groq text output.\n')
      await writeFile(join(runDir, 'minimax-output.md'), 'MiniMax text output.\n')

      await writeJson(join(runDir, 'run.json'), {
        schemaVersion: 2,
        kind: 'write',
        metadata: {
          step3: [
            {
              llmService: 'llama.cpp',
              llmModel: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
              processingTime: 2400,
              inputTokenCount: 2000,
              outputTokenCount: 1000,
              tokenCountSource: 'provider',
              providerUsage: { prompt_tokens: 2000, completion_tokens: 1000 },
              outputFileName: 'llama-output.md'
            },
            {
              llmService: 'groq',
              llmModel: 'openai/gpt-oss-120b',
              processingTime: 6000,
              inputTokenCount: 10000,
              outputTokenCount: 2000,
              tokenCountSource: 'provider',
              providerUsage: { prompt_tokens: 10000, completion_tokens: 2000, total_tokens: 12000 },
              rawProviderUsage: { queue_time: 0.01 },
              outputFileName: 'groq-output.md'
            },
            {
              llmService: 'minimax',
              llmModel: 'MiniMax-M3',
              processingTime: 2500,
              inputTokenCount: 3000,
              outputTokenCount: 500,
              tokenCountSource: 'provider',
              providerUsage: { total_tokens: 3500 },
              outputFileName: 'minimax-output.md'
            }
          ],
          cost: {
            actual: {
              steps: [
                { step: 'llm', provider: 'groq', model: 'openai/gpt-oss-120b', cost: 1.2 },
                { step: 'llm', provider: 'minimax', model: 'MiniMax-M3', cost: 3.6 }
              ]
            }
          },
          timing: {
            actual: {
              steps: [
                { step: 'llm', provider: 'llama.cpp', model: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M', processingTimeMs: 2400, msPerUnit: 800 },
                { step: 'llm', provider: 'groq', model: 'openai/gpt-oss-120b', processingTimeMs: 6000, msPerUnit: 300 },
                { step: 'llm', provider: 'minimax', model: 'MiniMax-M3', processingTimeMs: 2500, msPerUnit: 700 }
              ]
            }
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
      expect(report.providerGroups.local.count).toBe(1)
      expect(report.providerGroups.service.count).toBe(2)
      expect(report.providerGroups.local.providers[0]).toMatchObject({
        providerKey: 'llama.cpp/Meta-Llama-3.1-8B-Instruct-Q4_K_M',
        inputTokenCount: 2000,
        outputTokenCount: 1000,
        outputExists: true
      })
      expect(report.providerGroups.service.providers.find((provider) => provider.providerKey === 'groq/openai/gpt-oss-120b')).toMatchObject({
        inputTokenCount: 10000,
        outputTokenCount: 2000,
        providerUsage: { total_tokens: 12000 },
        rawProviderUsage: { queue_time: 0.01 }
      })
      expect(report.rankingSurfaces.local.price).toHaveLength(1)
      expect(report.rankingSurfaces.local.price[0]).toMatchObject({
        providerKey: 'llama.cpp/Meta-Llama-3.1-8B-Instruct-Q4_K_M',
        value: 0
      })
      expect(report.rankingSurfaces.service.price.map((entry) => entry.providerKey)).toEqual([
        'groq/openai/gpt-oss-120b',
        'minimax/MiniMax-M3'
      ])
      expect(report.rankingSurfaces.service.speed.map((entry) => [entry.providerKey, entry.metric, entry.value])).toEqual([
        ['groq/openai/gpt-oss-120b', 'msPerUnit', 300],
        ['minimax/MiniMax-M3', 'msPerUnit', 700]
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
