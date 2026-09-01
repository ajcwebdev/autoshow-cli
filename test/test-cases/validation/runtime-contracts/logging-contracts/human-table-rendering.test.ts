import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/utils/app-logger/core'
import { createReporter } from '~/utils/app-logger/reporter'
import {
  createDetailTable,
  createHumanTable,
  createKeyValueTable,
  createLocationsTable,
  renderHumanTable
} from '~/utils/app-logger/human-table/human-table'
import { createJsonSink } from '~/utils/app-logger/sinks/json-sink'
import { stripAnsi } from '~/utils/terminal-colors'
import type { LogSinkEvent } from '~/types'
import {
  captureConsole,
  createCapturingLogger,
  hasAnsi,
  withColorEnv
} from './shared'

describe('logging contracts', () => {
  test('colored human table output strips back to plain output', () => {
      const table = createHumanTable([
        {
          status: 'completed',
          path: 'output/run/manifest.json',
          providerModel: 'openai/gpt-5.5',
          durationMs: '1250ms',
          cost: '1.25000\u00a2'
        }
      ], ['status', 'path', 'providerModel', 'durationMs', 'cost'])

      const plain = withColorEnv({ noColor: '1' }, () => renderHumanTable(table))
      const colored = withColorEnv({ forceColor: '1' }, () => renderHumanTable(table))

      expect(hasAnsi(colored)).toBe(true)
      expect(stripAnsi(colored)).toBe(plain)
    })

  test('colored human table output keeps visible column widths aligned', () => {
      const table = createHumanTable([
        {
          status: 'completed',
          cost: '1.25000\u00a2',
          path: 'output/run/manifest.json',
          providerModel: 'openai/gpt-5.5',
          durationMs: '1250ms'
        },
        {
          status: 'failed',
          cost: '123.45600\u00a2',
          path: 'output/providers/openai/result.json',
          providerModel: 'gemini/veo-3.1-lite',
          durationMs: '98765ms'
        }
      ], ['status', 'cost', 'path', 'providerModel', 'durationMs'])

      const stripped = stripAnsi(withColorEnv({ forceColor: '1' }, () => renderHumanTable(table)))
      const lineWidths = new Set(stripped.split('\n').map(line => Bun.stringWidth(line)))
      expect(lineWidths.size).toBe(1)
      expect(stripped).toContain('\u2502 failed    \u2502 123.45600\u00a2')
      expect(stripped).toContain('\u2502 gemini/veo-3.1-lite')
    })

  test('provider model ids render as one color span', () => {
      const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
        { providerModel: 'elevenlabs/music_v2' }
      ], ['providerModel'])))

      expect(rendered).toMatch(/\x1b\[[0-9;]*melevenlabs\/music_v2\x1b\[0m/)
      expect(rendered).not.toMatch(/elevenlabs\x1b\[0m.*music_v2/)
    })

  test('slash paths render as one non-filename color span', () => {
      const path = './output/2026-04-29_10-21-25-009_1-audio/generated-music.mp3'
      const filename = 'generated-music.mp3'
      const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
        { path, file: filename }
      ], ['path', 'file'])))
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pathMatch = rendered.match(new RegExp(`(\\x1b\\[[0-9;]*m)${escapedPath}\\x1b\\[0m`))
      const fileMatch = rendered.match(new RegExp(`(\\x1b\\[[0-9;]*m)${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\x1b\\[0m`))

      expect(pathMatch?.[1]).toBeDefined()
      expect(fileMatch?.[1]).toBeDefined()
      expect(pathMatch?.[1]).not.toBe(fileMatch?.[1])
      expect(rendered).not.toMatch(/\.\/output\/2026-04-29_10-21-25-009_1-audio\/\x1b\[0m.*generated-music\.mp3/)
    })

  test('media type values are not color coded', () => {
      const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createKeyValueTable([
        ['mediaType', 'video']
      ])))

      expect(hasAnsi(rendered)).toBe(true)
      expect(rendered).not.toMatch(/\x1b\[[0-9;]*mvideo\x1b\[0m/)
    })

  test('ocr progress columns receive semantic colors', () => {
      const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(createHumanTable([
        {
          stream: 'stderr',
          page: 3,
          totalPages: 10,
          remoteId: 'job-123'
        }
      ], ['stream', 'page', 'totalPages', 'remoteId'])))

      expect(hasAnsi(rendered)).toBe(true)
      expect(rendered).toMatch(/\x1b\[[0-9;]*mstderr\x1b\[0m/)
      expect(rendered).toMatch(/\x1b\[[0-9;]*m3\x1b\[0m/)
      expect(rendered).toMatch(/\x1b\[[0-9;]*m10\x1b\[0m/)
      expect(rendered).toMatch(/\x1b\[[0-9;]*mjob-123\x1b\[0m/)
    })

  test('NO_COLOR disables ANSI output when set to a value or an empty string', () => {
    for (const noColor of ['1', '']) {
      const rendered = withColorEnv({ noColor }, () => renderHumanTable(createHumanTable([
        { status: 'failed', cost: '2.00000\u00a2', path: 'output/run/manifest.json' }
      ], ['status', 'cost', 'path'])))

      expect(hasAnsi(rendered)).toBe(false)
    }
  })

  test('human table widths follow terminal columns for Unicode, ANSI, hyperlinks, and right alignment', () => {
    const hyperlink = '\x1b]8;;https://example.invalid/docs\x07docs\x1b]8;;\x07'
    const table = createHumanTable([
      { sample: '漢字', value: '7' },
      { sample: 'e\u0301', value: '42' },
      { sample: '👩‍💻', value: '900' },
      { sample: '🇺🇸', value: '5' },
      { sample: '\x1b[35mviolet\x1b[0m', value: '12' },
      { sample: hyperlink, value: '1' }
    ], ['sample', 'value'], { align: { value: 'right' } })
    const rendered = withColorEnv({ forceColor: '1' }, () => renderHumanTable(table))
    const plain = stripAnsi(rendered)
    const boxedLines = rendered.split('\n').filter(line => line.includes('│') || line.includes('┌') || line.includes('├') || line.includes('└'))

    expect(new Set(boxedLines.map(line => Bun.stringWidth(line))).size).toBe(1)
    expect(plain).toContain('│ 漢字   │     7 │')
    expect(plain).toContain('│ e\u0301      │    42 │')
    expect(plain).toContain('│ 👩‍💻     │   900 │')
    expect(plain).toContain('│ 🇺🇸     │     5 │')
    expect(rendered).toContain(hyperlink)
  })

  test('multiline detail continuation aligns by terminal label width', () => {
    const rendered = renderHumanTable(createDetailTable([
      ['漢字👩‍💻', 'first line\nsecond line']
    ]))

    expect(rendered).toBe('  漢字👩‍💻: first line\n          second line')
    expect(Bun.stringWidth(rendered.split('\n')[1] ?? '')).toBe(Bun.stringWidth('          second line'))
  })

  test('wide-path and verbose-detail thresholds use terminal display width', () => {
    const widePath = `output/${'界'.repeat(24)}/result.json`
    const verboseMessage = '界'.repeat(49)
    const pathTable = createLocationsTable([{ artifact: 'manifest', path: widePath }])
    const messageTable = createHumanTable([{ status: 'failed', code: 'E_FAIL', message: verboseMessage }], ['status', 'code', 'message'])

    expect(widePath.length).toBeLessThanOrEqual(56)
    expect(Bun.stringWidth(widePath)).toBeGreaterThan(56)
    expect(pathTable.details).toEqual([{ label: 'manifest', value: widePath }])
    expect(verboseMessage.length).toBeLessThanOrEqual(96)
    expect(Bun.stringWidth(verboseMessage)).toBeGreaterThan(96)
    expect(messageTable.rows[0]?.['message']).toBe('see details')
    expect(messageTable.details).toEqual([{ label: 'message', value: verboseMessage }])
  })

  test('human artifact/path table rendering omits artifact/path header row', () => {
      const rendered = stripAnsi(renderHumanTable(createHumanTable([
        { artifact: 'manifest', path: 'output/run/manifest.json' }
      ], ['artifact', 'path'])))

      expect(rendered).toContain('\u2502 manifest \u2502 output/run/manifest.json')
      expect(rendered).not.toContain('\u2502 artifact \u2502 path')
      expect(rendered).not.toContain('\u2502 0 \u2502')
    })

  test('human key/value table rendering omits key/value header row', () => {
      const rendered = stripAnsi(renderHumanTable(createKeyValueTable([
        ['mediaType', 'video'],
        ['provider', 'gemini']
      ])))

      expect(rendered).toContain('\u2502 media type \u2502 video')
      expect(rendered).toContain('\u2502 provider   \u2502 gemini')
      expect(rendered).not.toContain('\u2502   \u2502 key')
      expect(rendered).not.toContain('\u2502 0 \u2502')
    })

  test('human table labels and millisecond durations render for display only', () => {
      const table = createKeyValueTable([
        ['outputDir', 'output/run'],
        ['processingTimeMs', 760412],
        ['providerModel', 'grok/grok-tts']
      ])
      const rendered = stripAnsi(renderHumanTable(table))

      expect(table.rows).toEqual([
        { key: 'outputDir', value: 'output/run' },
        { key: 'processingTimeMs', value: 760412 },
        { key: 'providerModel', value: 'grok/grok-tts' }
      ])
      expect(rendered).toContain('output dir')
      expect(rendered).toContain('time')
      expect(rendered).toContain('12m 40s')
      expect(rendered).toContain('provider/model')
      expect(rendered).not.toContain('760412')
    })

  test('long Locations paths render as sidecar details outside the boxed table', () => {
      const longPath = 'output/2026-05-13_22-39-03-656_ajcwebdevs-content-archive/manifest.json'
      const table = createLocationsTable([{ artifact: 'manifest', path: longPath }])
      const rendered = stripAnsi(renderHumanTable(table))

      expect(table.rows).toEqual([])
      expect(table.details).toEqual([{ label: 'manifest', value: longPath }])
      expect(rendered).toBe(`  manifest: ${longPath}`)
      expect(rendered).not.toContain('\u250c')
      expect(rendered).not.toContain(`\u2502 ${longPath}`)
    })

  test('completion provider table keeps counts inline and lifts long provider directory', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)
      const outputDir = 'output/2026-05-13_22-39-03-656_ajcwebdevs-content-archive'

      reporter.complete(outputDir, {
        'result-openai': 'providers/openai/result.json',
        'result-gemini': 'providers/gemini/result.json',
        'result-anthropic': 'providers/anthropic/result.json',
        'result-mistral': 'providers/mistral/result.json',
        'result-groq': 'providers/groq/result.json'
      })

      const providersTable = writes.find(write => write.message === 'Complete')?.options?.humanSections
        ?.find(section => section.title === 'Providers')?.table
      if (!providersTable) throw new Error('Expected Providers human table')

      const rendered = stripAnsi(renderHumanTable(providersTable))
      expect(providersTable.columns).toEqual(['transcripts', 'results'])
      expect(providersTable.rows).toEqual([{ transcripts: 0, results: 5 }])
      expect(providersTable.details).toEqual([{ label: 'dir', value: `${outputDir}/providers` }])
      expect(rendered).toContain('\u2502 transcripts \u2502 results')
      expect(rendered).toContain('\u2502           0 \u2502       5')
      expect(rendered).toContain(`\n  dir: ${outputDir}/providers`)
      expect(rendered).not.toContain('\u2502 dir ')
      expect(rendered).not.toContain(`\u2502 ${outputDir}/providers`)
    })

  test('reporter completion can omit output directory section after Run already announced it', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)

      reporter.complete('output/run', { speech: 'speech.wav', manifest: 'manifest.json' }, {
        includeOutputDir: false
      })

      const sections = writes[0]?.options?.humanSections ?? []
      expect(writes.map(write => write.message)).toEqual(['Complete'])
      expect(sections.map(section => section.title)).toEqual(['Artifacts'])
    })

  test('short filenames and short paths remain inline in human tables', () => {
      const table = createHumanTable([
        { artifact: 'manifest', path: 'output/run/manifest.json' },
        { artifact: 'audio', path: 'speech.wav' }
      ], ['artifact', 'path'])
      const rendered = stripAnsi(renderHumanTable(table))

      expect(table.details).toBeUndefined()
      expect(rendered).toContain('\u2502 manifest \u2502 output/run/manifest.json')
      expect(rendered).toContain('\u2502 audio    \u2502 speech.wav')
    })

  test('verbose error-like table cells render as sidecar details outside the box', () => {
      const rawError = [
        'Error: OpenAI OCR request failed',
        '    at request (/tmp/autoshow/openai.ts:42:10)',
        'stderr: provider returned a diagnostic line'
      ].join('\n')
      const table = createHumanTable([
        { provider: 'openai', status: 'failed', error: rawError }
      ], ['provider', 'status', 'error'])
      const rendered = stripAnsi(renderHumanTable(table))
      const boxedRows = rendered.split('\n').filter(line => line.includes('\u2502')).join('\n')

      expect(table.rows).toEqual([{
        provider: 'openai',
        status: 'failed',
        error: 'see details'
      }])
      expect(table.details).toEqual([{ label: 'openai error', value: rawError }])
      expect(boxedRows).not.toContain('OpenAI OCR request failed')
      expect(boxedRows).not.toContain('stderr: provider returned')
      expect(rendered).toContain('  openai error: Error: OpenAI OCR request failed')
      expect(rendered).toContain('    at request (/tmp/autoshow/openai.ts:42:10)')
      expect(rendered).toContain('stderr: provider returned a diagnostic line')
    })

  test('raw stderr key/value cells render as details while short progress details stay inline', () => {
      const rawStderr = 'fatal: first diagnostic line\nsecond diagnostic line'
      const stderrTable = createKeyValueTable([
        ['stderr', rawStderr]
      ])
      const renderedStderr = stripAnsi(renderHumanTable(stderrTable))
      const boxedRows = renderedStderr.split('\n').filter(line => line.includes('\u2502')).join('\n')

      expect(stderrTable.rows).toEqual([{ key: 'stderr', value: 'see details' }])
      expect(stderrTable.details).toEqual([{ label: 'stderr', value: rawStderr }])
      expect(boxedRows).not.toContain('fatal: first diagnostic line')
      expect(renderedStderr).toContain('  stderr: fatal: first diagnostic line')
      expect(renderedStderr).toContain('second diagnostic line')

      const progressTable = createHumanTable([
        { provider: 'deepinfra', detail: 'attempt 10' }
      ], ['provider', 'detail'])
      expect(progressTable.details).toBeUndefined()
      expect(stripAnsi(renderHumanTable(progressTable))).toContain('\u2502 deepinfra \u2502 attempt 10')
    })

  test('lifted path details are redacted like table cells', async () => {
      const secret = 'secret-value-123'
      const longPath = `output/2026-05-13_12-34-56-789_process-video_with-a-very-long-title/OPENAI_API_KEY=${secret}/manifest.json`
      const events: LogSinkEvent[] = []
      const logger = createLogger({
        runId: 'run-id',
        sinks: [event => events.push(event)]
      })

      logger.write('info', 'Locations', {
        category: 'artifact',
        humanTable: createLocationsTable([{ artifact: 'manifest', path: longPath }])
      })

      const detailValue = events[0]?.humanTable?.details?.[0]?.value
      expect(detailValue).toBe(`output/2026-05-13_12-34-56-789_process-video_with-a-very-long-title/OPENAI_API_KEY=REDACTED`)
      expect(String(detailValue)).not.toContain(secret)

      const captured = await captureConsole(() => createJsonSink()(events[0] as LogSinkEvent))
      expect(JSON.parse(captured.stdout[0] as string).humanTable.details[0]).toEqual({
        label: 'manifest',
        value: detailValue
      })
    })
})
