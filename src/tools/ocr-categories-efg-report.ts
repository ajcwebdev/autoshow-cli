import { buildBcOcrReports, inspectBcOcrReports } from './ocr-categories-bc-report'
import type { BcOcrReportOptions } from './ocr-categories-bc-report'

export { efgOcrEvaluationPolicy, scoreEfgNumericFidelity, scoreEfgOcrFidelity, validateEfgOcrStructure } from './ocr-categories-efg-metrics'
export type EfgOcrReportOptions = Omit<BcOcrReportOptions, 'reportProfile'>
export const inspectEfgOcrReports = (options: EfgOcrReportOptions = {}) => inspectBcOcrReports({ ...options, reportProfile: 'efg' })
export const buildEfgOcrReports = (options: EfgOcrReportOptions = {}) => buildBcOcrReports({ ...options, reportProfile: 'efg' })

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--build'].includes(arg))) throw new Error('Usage: bun src/tools/ocr-categories-efg-report.ts [--build]')
    if (args[0] === '--help') console.log('Usage: bun src/tools/ocr-categories-efg-report.ts [--build]\nDefault: read-only category5–7 coverage/spending inspection. --build assembles saved outputs and metric-only lexical reports. Numeric/punctuation fidelity is diagnostic; table cells, flowchart branches and page geometry are unmeasured. No provider calls.')
    else console.log(JSON.stringify(args[0] === '--build' ? await buildEfgOcrReports() : await inspectEfgOcrReports(), null, 2))
  } catch (error) { console.error(error instanceof Error ? error.message : 'Local category5–7 report assembly failed'); process.exitCode = 1 }
}
