import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const thisContractPath = resolve(import.meta.path)
const textExtensions = new Set(['.cjs', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.txt', '.yaml', '.yml'])

const legacyControlFilenames = [
  ['run', 'json'].join('.'),
  ['batch', 'json'].join('.'),
  ['extract-batch', 'json'].join('.'),
  ['checkpoint', 'json'].join('.'),
  ['provider-checkpoint', 'json'].join('.'),
  ['source', 'json'].join('.')
]

const legacyTypeAndHelperNames = [
  ['Run', 'Manifest'].join(''),
  ['Batch', 'Manifest'].join(''),
  ['Extract', 'Batch', 'Manifest'].join(''),
  ['Run', 'Manifest', 'Kind'].join(''),
  ['Batch', 'Manifest', 'Kind'].join(''),
  ['Provider', 'Manifest', 'Base'].join(''),
  ['Provider', 'Resume', 'Manifest'].join(''),
  ['Provider', 'Result'].join(''),
  ['Provider', 'Result', 'Payload'].join(''),
  ['Provider', 'Result', 'Schema'].join(''),
  ['Provider', 'Checkpoint', 'Manifest'].join(''),
  ['Extract', 'Batch', 'Manifest', 'Item'].join(''),
  ['Parsed', 'Item', 'Manifest'].join(''),
  ['Batch', 'Manifest', 'Entry'].join(''),
  ['Batch', 'Manifest', 'Error', 'Entry'].join(''),
  ['Batch', 'Manifest', 'Summary', 'Source'].join(''),
  ['Stt', 'Manifest', 'Provider', 'Summary'].join(''),
  ['Stt', 'Batch', 'Summary'].join(''),
  ['Versioned', 'Manifest'].join(''),
  ['Versioned', 'Manifest', 'Kind'].join(''),
  ['Versioned', 'Manifest', 'Read', 'Outcome'].join(''),
  ['CURRENT', 'MANIFEST', 'VERSION', 'BY', 'KIND'].join('_'),
  ['read', 'Versioned', 'Manifest'].join(''),
  ['unwrap', 'Versioned', 'Manifest'].join(''),
  ['read', 'Run', 'Manifest'].join(''),
  ['read', 'Run', 'Manifest', 'Entry'].join(''),
  ['read', 'Run', 'Manifest', 'Outcome'].join(''),
  ['write', 'Run', 'Manifest'].join(''),
  ['parse', 'Run', 'Manifest'].join(''),
  ['read', 'Batch', 'Manifest'].join(''),
  ['read', 'Batch', 'Manifest', 'Entry'].join(''),
  ['read', 'Batch', 'Manifest', 'Outcome'].join(''),
  ['write', 'Batch', 'Manifest'].join(''),
  ['parse', 'Batch', 'Manifest'].join(''),
  ['read', 'Extract', 'Batch', 'Manifest'].join(''),
  ['read', 'Extract', 'Batch', 'Manifest', 'Outcome'].join(''),
  ['write', 'Extract', 'Batch', 'Manifest'].join(''),
  ['parse', 'Extract', 'Batch', 'Manifest'].join(''),
  ['parse', 'Provider', 'Result'].join(''),
  ['write', 'Provider', 'Result'].join(''),
  ['read', 'Provider', 'Result', 'Entry'].join(''),
  ['parse', 'Manifest', 'Version'].join(''),
  ['validate', 'Manifest', 'Version'].join(''),
  ['assert', 'Supported', 'Manifest', 'Version'].join(''),
  ['manifest', 'Entry'].join('')
]

const legacyResumeRecordField = ['raw', 'Entry'].join('')

const legacyModuleStems = [
  ['manifest', 'utils'].join('-'),
  ['batch', 'manifest', 'entry'].join('-'),
  ['ocr', 'manifest'].join('-'),
  ['stt', 'manifest'].join('-'),
  ['url', 'manifest'].join('-')
]

const activeRunMarker = ['.active-run', 'json'].join('.')
const unsupportedSourceFixturePath = join(
  repositoryRoot,
  'test/test-cases/validation/cli/cli-usage-errors/tts-usage.test.ts'
)

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

const lineNumberFor = (content: string, index: number): number =>
  content.slice(0, index).split('\n').length

const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tokenPattern = (token: string): RegExp => new RegExp(`\\b${escaped(token)}\\b`, 'g')

const legacyFilenameRegex = new RegExp(
  `(^|[/\\s'"\u0060([=:])(?:${legacyControlFilenames.map(escaped).join('|')})(?=$|[/\\s'"\u0060)\\],;:])`,
  'gm'
)

const legacyTokenRegex = new RegExp(
  `\\b(?:${[...legacyTypeAndHelperNames, ...legacyModuleStems].map(escaped).join('|')})\\b`,
  'g'
)

const legacyResumeRecordFieldRegex = tokenPattern(legacyResumeRecordField)

const currentTreeFiles = async (): Promise<string[]> =>
  (await Promise.all(scanRoots.map(walkFiles))).flat().filter((path) => {
    if (path === thisContractPath || path.includes(`${join(repositoryRoot, 'docs/reports')}/`)) {
      return false
    }
    return textExtensions.has(extname(path))
  })

describe('canonical persistence legacy guard', () => {
  test('current source, tests, docs, fixtures, and consensus skill contain no old persistence surface', async () => {
    const violations: string[] = []

    for (const path of await currentTreeFiles()) {
      let content = await readFile(path, 'utf8')
      content = content.split(activeRunMarker).join('')
      if (path === unsupportedSourceFixturePath) {
        content = content.split(legacyControlFilenames.at(-1) ?? '').join('')
      }

      for (const match of content.matchAll(legacyFilenameRegex)) {
        const filename = match[0].slice((match[1] ?? '').length)
        violations.push(`${relative(repositoryRoot, path)}:${lineNumberFor(content, match.index ?? 0)} references ${filename}`)
      }
      for (const filename of legacyControlFilenames) {
        if (basename(path) === filename) {
          violations.push(`${relative(repositoryRoot, path)} uses the retired control filename ${filename}`)
        }
      }

      for (const match of content.matchAll(legacyTokenRegex)) {
        violations.push(`${relative(repositoryRoot, path)}:${lineNumberFor(content, match.index ?? 0)} references ${match[0]}`)
      }

      if (
        path.includes('/commands/setup-and-utilities/resume/')
        || path.includes('/types/setup-support/resume-types.ts')
        || path.includes('/validation/resume-manifests/')
      ) {
        for (const match of content.matchAll(legacyResumeRecordFieldRegex)) {
          violations.push(`${relative(repositoryRoot, path)}:${lineNumberFor(content, match.index ?? 0)} references ${legacyResumeRecordField}`)
        }
      }
    }

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
    const resultFilename = ['result', 'json'].join('.')
    const schemaField = ['schema', 'Version'].join('')
    const kindField = ['kind'].join('')
    const providerField = ['provider'].join('')
    const metadataField = ['meta', 'data'].join('')
    const resultField = ['result'].join('')
    const violations: string[] = []

    for (const path of (await Promise.all(fixtureRoots.map(walkFiles))).flat()) {
      if (basename(path) !== resultFilename) {
        continue
      }
      const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
      const isEnvelope = isRecord(parsed)
        && providerField in parsed
        && metadataField in parsed
        && resultField in parsed
      if (!isRecord(parsed) || schemaField in parsed || kindField in parsed || isEnvelope) {
        violations.push(relative(repositoryRoot, path))
        continue
      }

      const isProviderArtifact = path.split('/').includes('providers')
      const runDir = isProviderArtifact ? dirname(dirname(dirname(path))) : dirname(path)
      const manifestPath = join(runDir, ['manifest', 'json'].join('.'))
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
      const items = isRecord(manifest) && Array.isArray(manifest['items']) ? manifest['items'] : []
      const providerState = items
        .filter(isRecord)
        .flatMap((item) => Array.isArray(item['providers']) ? item['providers'].filter(isRecord) : [])
        .find((provider) => typeof provider['artifactDir'] === 'string' && (
          isProviderArtifact
            ? basename(provider['artifactDir']) === basename(dirname(path))
            : provider['artifactDir'] === '.'
        ))
      if (!providerState || stableJson(providerState['result']) !== stableJson(parsed)) {
        violations.push(`${relative(repositoryRoot, path)} does not match its canonical provider result`)
      }
    }

    expect(violations).toEqual([])
  })
})
