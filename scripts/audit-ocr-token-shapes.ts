import { auditOcrTokenShapes } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-token-shape-audit'

const args = Bun.argv.slice(2)
const runDirectories: string[] = []
let profilePath: string | undefined
let includeAllTokenProviders = false

for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--run-dir') {
    const value = args[++index]
    if (!value) throw new Error('--run-dir requires a path')
    runDirectories.push(value)
  } else if (arg === '--profile') {
    profilePath = args[++index]
    if (!profilePath) throw new Error('--profile requires a path')
  } else if (arg === '--all-token-providers') {
    includeAllTokenProviders = true
  } else {
    throw new Error(`Unknown argument: ${arg ?? ''}`)
  }
}

const report = await auditOcrTokenShapes({
  runDirectories,
  ...(profilePath ? { profilePath } : {}),
  includeAllTokenProviders
})
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
