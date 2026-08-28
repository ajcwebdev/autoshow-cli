import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { isRecord } from '../../../test-utils/test-helpers'
import { collectLegacySurfaceViolations, shouldScanLegacySurfacePath } from './legacy-surface-scanner'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const thisContractPath = resolve(import.meta.path)
const textExtensions = new Set(['.cjs', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.txt', '.yaml', '.yml'])

const scanRoots = [
  resolve(repositoryRoot, 'src'),
  resolve(repositoryRoot, 'test'),
  resolve(repositoryRoot, 'docs/commands'),
  resolve(repositoryRoot, 'docs/benchmarks'),
  resolve(repositoryRoot, 'docs/diagrams'),
  resolve(repositoryRoot, 'docs/diagrams.md'),
  resolve(repositoryRoot, 'docs/release-v0.1.md'),
  resolve(repositoryRoot, 'docs/adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md'),
  resolve(repositoryRoot, '.codex/skills/consensus'),
  resolve(repositoryRoot, 'README.md')
]

const stableJson = (value: unknown): string => JSON.stringify(value, (_key, nested) =>
  isRecord(nested)
    ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)))
    : nested
)

const walkFilesCache = new Map<string, Promise<string[]>>()

const walkFiles = (path: string): Promise<string[]> => {
  const cached = walkFilesCache.get(path)
  if (cached) return cached

  const pending = (async (): Promise<string[]> => {
    const file = Bun.file(path)
    if (await file.exists() && extname(path) !== '') {
      return [path]
    }

    let entries
    try {
      entries = await readdir(path, { withFileTypes: true })
    } catch {
      return []
    }

    const nested = await Promise.all(entries.flatMap((entry) => {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        return []
      }
      return [walkFiles(join(path, entry.name))]
    }))
    return nested.flat()
  })()

  walkFilesCache.set(path, pending)
  return pending
}

const currentTreeFiles = async (): Promise<string[]> =>
  (await Promise.all(scanRoots.map(walkFiles))).flat().filter((path) => {
    return shouldScanLegacySurfacePath(path, repositoryRoot, thisContractPath) && textExtensions.has(extname(path))
  })

const providerResultFilename = ['result', 'json'].join('.')
const providerResultSchemaField = ['schema', 'Version'].join('')
const providerResultKindField = ['kind'].join('')
const providerResultProviderField = ['provider'].join('')
const providerResultMetadataField = ['meta', 'data'].join('')
const providerResultField = ['result'].join('')

const invalidProviderResultShape = (parsed: unknown): boolean => {
  if (!isRecord(parsed)) return true
  const isEnvelope = providerResultProviderField in parsed
    && providerResultMetadataField in parsed
    && providerResultField in parsed
  return providerResultSchemaField in parsed || providerResultKindField in parsed || isEnvelope
}

const matchingProviderState = (manifest: unknown, path: string, isProviderArtifact: boolean) => {
  const items = isRecord(manifest) && Array.isArray(manifest['items']) ? manifest['items'] : []
  return items
    .filter(isRecord)
    .flatMap(item => Array.isArray(item['providers']) ? item['providers'].filter(isRecord) : [])
    .find(provider => typeof provider['artifactDir'] === 'string' && (
      isProviderArtifact
        ? basename(provider['artifactDir']) === basename(dirname(path))
        : provider['artifactDir'] === '.'
    ))
}

const auditProviderResultArtifact = async (path: string): Promise<string[]> => {
  if (basename(path) !== providerResultFilename) return []
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
  const displayPath = relative(repositoryRoot, path)
  if (invalidProviderResultShape(parsed)) return [displayPath]

  const isProviderArtifact = path.split('/').includes('providers')
  const runDir = isProviderArtifact ? dirname(dirname(dirname(path))) : dirname(path)
  const manifestPath = join(runDir, ['manifest', 'json'].join('.'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
  const providerState = matchingProviderState(manifest, path, isProviderArtifact)
  return providerState && stableJson(providerState['result']) === stableJson(parsed)
    ? []
    : [`${displayPath} does not match its canonical provider result`]
}

describe('canonical persistence legacy guard', () => {
  test('current source, tests, docs, fixtures, and consensus skill contain no old persistence surface', async () => {
    const violations = (await Promise.all(
      (await currentTreeFiles()).map(async path => collectLegacySurfaceViolations(path, await readFile(path, 'utf8'), repositoryRoot))
    )).flat()

    expect(violations).toEqual([])
  })

  test('committed pipeline manifests are canonical and unversioned', async () => {
    const fixtureRoots = [
      resolve(repositoryRoot, 'docs/benchmarks'),
      resolve(repositoryRoot, '.codex/skills/consensus/evals/files')
    ]
    const manifestFilename = ['manifest', 'json'].join('.')
    const schemaField = ['schema', 'Version'].join('')
    const kindField = ['kind'].join('')
    const violations: string[] = []

    for (const path of (await Promise.all(fixtureRoots.map(walkFiles))).flat()) {
      if (basename(path) !== manifestFilename) {
        continue
      }
      const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
      if (
        !isRecord(parsed)
        || typeof parsed['command'] !== 'string'
        || (parsed['scope'] !== 'single' && parsed['scope'] !== 'batch')
        || !Array.isArray(parsed['items'])
        || schemaField in parsed
        || kindField in parsed
      ) {
        violations.push(relative(repositoryRoot, path))
      }
    }

    expect(violations).toEqual([])
  })

  test('provider result artifacts are direct domain JSON, never persistence envelopes', async () => {
    const fixtureRoots = [
      resolve(repositoryRoot, 'docs/benchmarks'),
      resolve(repositoryRoot, '.codex/skills/consensus/evals/files')
    ]
    const violations = (await Promise.all(
      (await Promise.all(fixtureRoots.map(walkFiles))).flat().map(auditProviderResultArtifact)
    )).flat()

    expect(violations).toEqual([])
  })
})
