import { lstat, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { ValidationError } from '~/utils/error-handler'

export const publishTranscriptReview = async (output: string, artifacts: Record<string, string>, sourceWordCount: number): Promise<void> => {
  const files: Record<string, string> = {}
  await mkdir(output, { recursive: true })
  for (const name of Object.keys(artifacts)) if (await lstat(join(output, name)).catch(() => undefined)) throw ValidationError(`Refusing to overwrite ${join(output, name)}; choose a new --output-dir.`)
  for (const [name, text] of Object.entries(artifacts)) { await writeFile(join(output, name), text, { flag: 'wx' }); files[name] = name }
  l.report.complete(output, files, { metrics: { sourceWordCount, providerCalls: 0 } })
}
