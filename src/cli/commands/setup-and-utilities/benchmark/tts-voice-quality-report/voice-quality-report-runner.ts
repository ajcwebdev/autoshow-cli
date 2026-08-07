import * as l from '~/utils/app-logger/app-logger'
import { parseVoiceQualityReportArgs } from './voice-quality-report-args'
import { writeVoiceQualityReport } from './report-writing'

async function main(): Promise<number> {
  const args = parseVoiceQualityReportArgs(process.argv.slice(2))
  await writeVoiceQualityReport(args)
  return 0
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      l.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
