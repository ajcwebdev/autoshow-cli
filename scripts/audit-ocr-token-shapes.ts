import { auditOcrTokenShapes } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-token-shape-audit'

const args = Bun.argv.slice(2)
const runDirectories: string[] = []
let profilePath: string | undefined
let includeAllTokenProviders = false
let showPlan = false

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
  } else if (arg === '--plan') {
    showPlan = true
  } else {
    throw new Error(`Unknown argument: ${arg ?? ''}`)
  }
}

if (showPlan) {
  const planOutput = {
    summary: 'OCR Token-Shape Calibration Execution Plan',
    guarantee: 'Zero cost / zero risk guarantee: These paid commands require explicit user execution and approval.',
    estimatedCost: '11.487¢ total max risk across 6 commands',
    commands: [
      'bun autoshow extract input/examples/document/1-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled',
      'bun autoshow extract input/examples/document/3-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled',
      'bun autoshow extract input/examples/document/4-document.pdf --provider kimi=kimi-k2.6 --reasoning-effort disabled',
      'bun autoshow extract input/examples/document/1-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low',
      'bun autoshow extract input/examples/document/3-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low',
      'bun autoshow extract input/examples/document/4-document.pdf --provider gemini=gemini-3.1-pro-preview --reasoning-effort low'
    ]
  }
  process.stdout.write(`${JSON.stringify(planOutput, null, 2)}\n`)
} else {
  const report = await auditOcrTokenShapes({
    runDirectories,
    ...(profilePath ? { profilePath } : {}),
    includeAllTokenProviders
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}
