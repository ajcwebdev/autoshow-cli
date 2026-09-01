import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [pidPath, artifactRoot] = Bun.argv.slice(2)
if (!pidPath || !artifactRoot) throw new Error('Expected PID and artifact paths')

const outputDir = join(artifactRoot, 'recoverable-output')
const ttsWorkingDir = join(artifactRoot, 'recoverable-tts-work')
await mkdir(outputDir, { recursive: true })
await mkdir(ttsWorkingDir, { recursive: true })
await writeFile(join(outputDir, 'completed-segment.wav'), 'completed local fixture audio')
await writeFile(join(ttsWorkingDir, 'reconciliation.json'), '{"state":"ambiguous"}\n')

const descendant = Bun.spawn([
  process.execPath,
  '--no-env-file',
  '-e',
  'setInterval(() => {}, 1000)'
], {
  stdin: 'ignore',
  stdout: 'ignore',
  stderr: 'ignore'
})

await writeFile(pidPath, `${descendant.pid}\n`)
process.stdout.write('ready\n')
await new Promise<void>(() => {})
