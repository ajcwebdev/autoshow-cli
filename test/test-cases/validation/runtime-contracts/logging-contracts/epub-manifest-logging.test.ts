import { describe, expect, test } from 'bun:test'
import { buildWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { renderHumanTable } from '~/utils/app-logger/human-table/human-table'
import { stripAnsi } from '~/utils/terminal-colors'

describe('EPUB manifest logging contracts', () => {
  test('native EPUB extract manifest summary displays sections instead of pages', () => {
    const metadata = {
      step2: {
        extractionMethod: 'epub-text',
        totalPages: 9,
        ocrPages: 0,
        textPages: 9,
        processingTime: 60000,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 12000,
        outputFidelity: 'cleaned-epub-text'
      },
      timing: {
        actual: {
          totalProcessingTimeMs: 60000,
          steps: [{
            step: 'extract',
            provider: 'extract',
            model: 'epub-text',
            processingTimeMs: 60000,
            inputMetric: 'sections',
            inputValue: 9,
            throughputValue: 9,
            throughputUnit: 'sectionsPerMinute'
          }]
        }
      }
    }

    const summary = buildWriteManifestConsoleSummary(metadata)

    expect(summary.promptUsage?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'extract/epub-text',
      usage: '9 sections'
    })
    expect(summary.runSummary?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'extract/epub-text',
      actualSpeed: '9 sections/min',
      actualInputMetric: 'sections',
      actualInputValue: 9
    })

    const renderedPromptUsage = summary.promptUsage?.humanTable
      ? stripAnsi(renderHumanTable(summary.promptUsage.humanTable))
      : ''
    const renderedRunSummary = summary.runSummary?.humanTable
      ? stripAnsi(renderHumanTable(summary.runSummary.humanTable))
      : ''
    expect(renderedPromptUsage).toContain('9 sections')
    expect(renderedPromptUsage).not.toContain('9 pages')
    expect(renderedRunSummary).toContain('9 sections/min')
  })

  test('native EPUB extract manifest summary includes logical chapters when heading export expands one source section', () => {
    const metadata = {
      step2: {
        extractionMethod: 'epub-text',
        totalPages: 1,
        ocrPages: 0,
        textPages: 1,
        processingTime: 60000,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 12000,
        outputFidelity: 'cleaned-epub-text',
        chapterExport: {
          sourceFormat: 'epub',
          mode: 'chapters',
          sectionsKept: 1,
          sectionsDropped: 0,
          dividerSectionsMerged: 0,
          logicalChapterCount: 4,
          logicalChapterSource: 'heading',
          tocStartSections: 1,
          genericTocStartsIgnored: 1,
          filesWritten: 4,
          chapterFilesWritten: 4,
          directories: ['chapters']
        }
      }
    }

    const summary = buildWriteManifestConsoleSummary(metadata)

    expect(summary.promptUsage?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'extract/epub-text',
      usage: '1 section / 4 chapters'
    })

    const renderedPromptUsage = summary.promptUsage?.humanTable
      ? stripAnsi(renderHumanTable(summary.promptUsage.humanTable))
      : ''
    expect(renderedPromptUsage).toContain('1 section / 4 chapters')
  })
})
