import { describe, expect, test } from 'bun:test'
import { buildAudioNormalizeTable } from '~/cli/commands/process-steps/step-1-download/audio/audio-logging'
import { buildResumeSummaryTable } from '~/cli/commands/setup-and-utilities/resume/resume-logging'
import { buildSuitePriceSummaryRows } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import { buildSetupToolStatusTable } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import {
  buildHostedProviderConfigurationLogTable,
  buildHostedProviderConfigurationRows,
  buildHostedProviderConfigurationSummaryTable,
  buildHostedProviderConfigurationTable,
  summarizeHostedProviderRows
} from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'

describe('logging contracts', () => {
  test('table builders produce stable completion output', () => {
      expect(buildResumeSummaryTable({ full: 3, incomplete: 1, failed: 0 }).rows).toEqual([{
        full: 3,
        incomplete: 1,
        failed: 0
      }])
      expect(buildSuitePriceSummaryRows({
        checkedLabel: 'commands',
        checkedCount: 3,
        totalEstimatedCost: 12.345678
      })).toEqual([{
        checked: '3 commands',
        totalEstimatedCost: '12.35\u00a2'
      }])
      const providerRows = buildHostedProviderConfigurationRows(
        { OPENAI_API_KEY: 'sk-test' },
        { envVars: ['OPENAI_API_KEY', 'GEMINI_API_KEY'] }
      )
      expect(providerRows).toEqual([
        {
          provider: 'OpenAI write/OCR/TTS/image',
          status: 'configured',
          envKey: 'OPENAI_API_KEY',
          detail: 'set'
        },
        {
          provider: 'Gemini write/STT/OCR/TTS/image/video/music',
          status: 'missing',
          envKey: 'GEMINI_API_KEY',
          detail: 'set GEMINI_API_KEY to enable'
        }
      ])
      expect(summarizeHostedProviderRows(providerRows)).toEqual({
        configured: 1,
        missing: 1,
        total: 2
      })
      expect(buildHostedProviderConfigurationTable(providerRows)).toEqual({
        columns: ['provider', 'status', 'envKey', 'detail'],
        rows: providerRows
      })

      expect(buildHostedProviderConfigurationLogTable(providerRows, { mode: 'missing' })).toEqual({
        columns: ['provider', 'status', 'envKey', 'detail'],
        rows: [providerRows[1]!],
        details: [{ label: 'configured', value: '1/2' }]
      })

      expect(buildHostedProviderConfigurationSummaryTable({
        configured: 2,
        missing: 0,
        total: 2
      })).toEqual({
        columns: ['present', 'missing', 'detail'],
        rows: [{
          present: '2/2',
          missing: 0,
          detail: 'all env vars set (presence only, not validated)'
        }]
      })

      const longRuntimePath = '/Users/ajc/c/as/autoshow-cli/runtime/bin/whisper-cli'
      expect(buildSetupToolStatusTable({
        tool: 'whisper-cli',
        status: 'ready',
        detail: longRuntimePath
      })).toEqual({
        columns: ['tool', 'status'],
        rows: [{
          tool: 'whisper-cli',
          status: 'ready'
        }],
        details: [{ label: 'path', value: longRuntimePath }]
      })
    })

  test('audio normalize table uses vertical key/value display rows', () => {
      expect(buildAudioNormalizeTable({
        status: 'planned',
        inputPath: '/tmp/autoshow/source episode.m4a',
        outputPath: '/tmp/autoshow/source episode.normalized.mp3',
        plan: {
          profile: 'default',
          mode: 'transcode-mp3',
          outputExtension: '.mp3',
          outputFormat: 'mp3',
          outputCodecName: 'mp3',
          sourceCodecName: 'aac',
          reason: 'container or codec requires normalization',
          stripMetadata: true,
          stripChapters: true
        }
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'status', value: 'planned' },
          { key: 'mode', value: 'transcode-mp3' },
          { key: 'codec', value: 'aac->mp3' },
          { key: 'input', value: 'source episode.m4a' },
          { key: 'output', value: 'source episode.normalized.mp3' },
          { key: 'detail', value: 'container or codec requires normalization' }
        ]
      })
    })
})
