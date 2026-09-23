import { UsageError } from '~/utils/error-handler'
import { auditOcrTokenShapes } from '~/cli/commands/text/ocr/ocr-pricing/ocr-token-shape-audit'

const args = Bun.argv.slice(2)
const runDirectories: string[] = []
let profilePath: string | undefined
let includeAllTokenProviders = false

for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--run-dir') {
    const value = args[++index]
    if (!value) throw UsageError('--run-dir requires a path')
    runDirectories.push(value)
  } else if (arg === '--profile') {
    profilePath = args[++index]
    if (!profilePath) throw UsageError('--profile requires a path')
  } else if (arg === '--all-token-providers') {
    includeAllTokenProviders = true
  } else {
    throw UsageError(`Unknown argument: ${arg ?? ''}`)
  }
}

const report = await auditOcrTokenShapes({
  runDirectories,
  ...(profilePath ? { profilePath } : {}),
  includeAllTokenProviders
})
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
