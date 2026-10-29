import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { PROJECT_ROOT, toProjectRelativePath } from '~/utils/project-root'

type SourceCatalog = {
  schemaVersion: number
  sources: Array<{
    id: string
    path: string
    bytes: number
    sha256: string
    runs: Array<{ path: string }>
  }>
}

const containedPath = (root: string, value: string): string => {
  const path = resolve(root, value)
  const rel = relative(root, path)
  if (!value || isAbsolute(value) || rel === '..' || rel.startsWith(`..${sep}`)) throw ValidationError(`Expected a repository-relative source path: ${value}`)
  return path
}

export const verifySttBenchmarkSources = async (
  catalogPath = resolve(PROJECT_ROOT, 'docs/benchmarks/stt/sources/catalog.json'),
  projectRoot = PROJECT_ROOT
): Promise<{ sources: number; runs: number; bytes: number }> => {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as SourceCatalog
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.sources) || catalog.sources.length === 0) throw ValidationError('Unsupported STT source catalog')
  const identities = new Set<string>()
  let runs = 0, totalBytes = 0
  for (const source of catalog.sources) {
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes <= 0 || identities.has(source.sha256)) throw ValidationError(`Invalid or duplicate STT source identity: ${source.id}`)
    identities.add(source.sha256)
    const sourcePath = containedPath(projectRoot, source.path)
    let bytes: Buffer
    try { bytes = await readFile(sourcePath) } catch (cause) { throw InfraError(`Restore the canonical STT recording at ${source.path} and retry.`, { cause }) }
    if (bytes.length !== source.bytes || createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw ValidationError(`STT source integrity mismatch: ${source.path}`)
    if (!Array.isArray(source.runs) || source.runs.length === 0) throw ValidationError(`STT source has no run bindings: ${source.id}`)
    for (const run of source.runs) {
      const runDir = containedPath(projectRoot, run.path)
      let manifestBytes: string
      try { manifestBytes = await readFile(resolve(runDir, 'manifest.json'), 'utf8') } catch (cause) { throw InfraError(`Restore the catalogued STT run at ${run.path} and retry.`, { cause }) }
      const manifest = JSON.parse(manifestBytes) as {
        items: Array<{ metadata: { step1: { url: string; audioFileName: string; audioFileSize: number; slug: string } } }>
      }
      const step1 = manifest.items[0]?.metadata.step1
      if (!step1 || step1.url !== source.path || step1.audioFileSize !== source.bytes || step1.slug !== source.id || resolve(runDir, step1.audioFileName) !== sourcePath) throw ValidationError(`STT run does not resolve to its canonical recording: ${run.path}`)
      const prompt = await readFile(resolve(runDir, 'prompt.md'), 'utf8')
      if (!prompt.split('\n').includes(`url: "${source.path}"`)) throw ValidationError(`STT prompt does not reference its canonical recording: ${run.path}`)
      runs++
    }
    totalBytes += source.bytes
  }
  return { sources: catalog.sources.length, runs, bytes: totalBytes }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.length > 1 || args.some(arg => arg.startsWith('-'))) throw UsageError('Usage: bun src/tools/verify-stt-benchmark-sources.ts [catalog.json]')
  const catalogPath = args[0] ? resolve(args[0]) : undefined
  const result = await verifySttBenchmarkSources(catalogPath)
  writeCommandPayload(JSON.stringify({ ...result, catalog: toProjectRelativePath(catalogPath ?? resolve(PROJECT_ROOT, 'docs/benchmarks/stt/sources/catalog.json')), verified: true }) + '\n')
}
