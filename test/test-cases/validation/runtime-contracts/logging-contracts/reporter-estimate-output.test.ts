import { describe, expect, test } from 'bun:test'
import { createReporter } from '~/utils/app-logger/reporter'
import { renderHumanTable } from '~/utils/app-logger/human-table/human-table'
import { stripAnsi } from '~/utils/terminal-colors'
import type { StepEstimate } from '~/types'
import { createCapturingLogger } from './shared'

describe('reporter estimate output contracts', () => {
  test('reporter ignores estimate notes in human pricing output', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 1.25,
      steps: [{
        step: 'tts',
        provider: 'openai',
        model: 'gpt-4o-mini-tts-2025-12-15',
        totalCost: 1.25
      }],
      notes: [
        'First aggregate estimate note.',
        'Second aggregate estimate note.'
      ]
    })

    expect(writes.map(write => write.message)).toEqual(['Estimate'])
    expect(writes[0]?.options?.humanTable?.details).toEqual([
      { label: 'Total estimated cost', value: '1.25\u00a2 (1.250\u00a2)' }
    ])
    expect(writes[0]?.options?.humanSections?.[0]?.title).toBe('Cost Estimate')
    expect(writes[0]?.options?.humanSections?.[0]?.table).toBeDefined()
    expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)
  })

  test('reporter renders aggregate cost estimates as compact rows without note output', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)

    reporter.estimate({
      totalEstimatedCost: 201.255,
      steps: [
        {
          step: 'video',
          provider: 'gemini',
          model: 'veo-3.1-lite-generate-preview',
          durationSeconds: 4,
          totalCost: 200
        },
        {
          step: 'tts',
          provider: 'openai',
          model: 'gpt-4o-mini-tts-2025-12-15',
          totalCost: 1.25,
          characterCount: 100,
          note: 'Provider credits may apply outside local estimates.'
        },
        {
          step: 'extract',
          provider: 'firecrawl',
          model: 'firecrawl',
          totalCost: 0.005,
          note: 'Provider credits may apply outside local estimates.'
        }
      ],
      notes: ['Aggregate caveat.']
    })

    const humanTable = writes[0]?.options?.humanSections
      ?.find(section => section.title === 'Cost Estimate')?.table
    expect(humanTable).toEqual({
      columns: ['step', 'provider', 'model', 'cost'],
      align: { cost: 'right' },
      rows: [
        { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', cost: '$2.00' },
        { step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts-2025-12-15', cost: '1.25\u00a2' },
        { step: 'extract', provider: 'firecrawl', model: 'firecrawl', cost: '<0.01\u00a2' }
      ]
    })
    expect(writes[0]?.message).toBe('Estimate')
    expect(writes[0]?.options?.humanTable?.details).toEqual([
      { label: 'Total estimated cost', value: '$2.01 (201.255\u00a2)' }
    ])
    expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)

    if (!humanTable) throw new Error('Expected cost estimate human table')
    const rendered = stripAnsi(renderHumanTable(humanTable))
    expect(rendered).toContain('\u2502 video   \u2502 gemini')
    expect(rendered).toContain('\u2502  $2.00 \u2502')
    expect(rendered).toContain('\u2502 <0.01\u00a2 \u2502')
    expect(rendered).not.toContain('[1]')
    expect(rendered).not.toContain('\u2502 key')
  })

  test('reporter omits human cost details for detail-heavy estimate types', () => {
    const { logger, writes } = createCapturingLogger()
    const reporter = createReporter(logger)
    const steps = [
      {
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        durationSeconds: 123,
        estimateType: 'heuristic',
        totalCost: 4.1
      },
      {
        step: 'llm',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125,
        estimatedInputTokens: 600,
        estimatedOutputTokens: 400,
        totalCost: 0.062
      },
      {
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125,
        pageCount: 2,
        promptTokens: 5972,
        completionTokens: 3688,
        estimateType: 'heuristic',
        totalCost: 0.58044
      },
      {
        step: 'extract',
        provider: 'glm-reader',
        model: 'glm-reader',
        costPer1kPagesCents: 1000,
        pageCount: 1,
        totalCost: 1
      },
      {
        step: 'tts',
        provider: 'mistral',
        model: 'voxtral-mini-tts-2603',
        inputCostPer1MCharactersCents: 0,
        outputCostPer1MCharactersCents: 1600,
        characterCount: 1000,
        setupCostCents: 0,
        estimateType: 'heuristic',
        totalCost: 1.6
      },
      {
        step: 'music',
        provider: 'minimax',
        model: 'music-3.0',
        durationSeconds: 180,
        lyricsSource: 'generated',
        totalCost: 500
      }
    ] satisfies StepEstimate[]

    reporter.estimate({
      totalEstimatedCost: steps.reduce((total, step) => total + step.totalCost, 0),
      steps
    })

    const humanTable = writes[0]?.options?.humanSections
      ?.find(section => section.title === 'Cost Estimate')?.table
    if (!humanTable) throw new Error('Expected cost estimate human table')

    expect(humanTable.columns).toEqual(['step', 'provider', 'model', 'setup', 'cost'])
    expect(humanTable.details).toBeUndefined()
    expect(humanTable.rows.every(row => row['details'] === undefined)).toBe(true)

    const rendered = stripAnsi(renderHumanTable(humanTable))
    expect(rendered).not.toContain('details')
    expect(rendered).not.toContain('see details')
    expect(rendered).not.toContain('rate $10.00/1K pages')
    expect(rendered).not.toContain('lyrics generated')
    expect(rendered).not.toContain('tokens')
    expect(rendered).not.toContain('characters')
  })
})
