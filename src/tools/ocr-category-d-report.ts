import { buildBcOcrReports, inspectBcOcrReports } from './ocr-categories-bc-report'
import type { BcOcrReportOptions } from './ocr-categories-bc-report'

export { scoreAnnotatedTokenCoverage } from './ocr-categories-bc-report'
export type CategoryDOcrReportOptions = Omit<BcOcrReportOptions, 'reportProfile'>

export const inspectCategoryDOcrReports = (options: CategoryDOcrReportOptions = {}) => inspectBcOcrReports({ ...options, reportProfile: 'advertisements' })
export const buildCategoryDOcrReports = (options: CategoryDOcrReportOptions = {}) => buildBcOcrReports({ ...options, reportProfile: 'advertisements' })

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--build'].includes(arg))) throw new Error('Usage: bun src/tools/ocr-category-d-report.ts [--build]')
    if (args[0] === '--help') console.log('Usage: bun src/tools/ocr-category-d-report.ts [--build]\nDefault: read-only category4 coverage/spending inspection. --build assembles saved original-image outputs and metric-only reports. Partial TextOCR references have no primary spatial accuracy score; annotated-token coverage is diagnostic only. No provider calls.')
    else console.log(JSON.stringify(args[0] === '--build' ? await buildCategoryDOcrReports() : await inspectCategoryDOcrReports(), null, 2))
  } catch (error) { console.error(error instanceof Error ? error.message : 'Local category4 report assembly failed'); process.exitCode = 1 }
}
