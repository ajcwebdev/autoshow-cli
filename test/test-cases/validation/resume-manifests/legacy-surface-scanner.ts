import { basename, join, relative } from 'node:path'

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

const lineNumberFor = (content: string, index: number): number => content.slice(0, index).split('\n').length
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

const scansResumeRecordFields = (path: string): boolean =>
  path.includes('/commands/setup-and-utilities/resume/')
  || path.includes('/types/setup-support/resume-types.ts')
  || path.includes('/validation/resume-manifests/')

export const shouldScanLegacySurfacePath = (path: string, repositoryRoot: string, contractPath: string): boolean =>
  path !== contractPath && !path.includes(`${join(repositoryRoot, 'docs/reports')}/`)

export const normalizeLegacyScanContent = (path: string, content: string, repositoryRoot: string): string => {
  const withoutActiveRun = content.split(activeRunMarker).join('')
  const unsupportedSourceFixturePath = join(repositoryRoot, 'test/test-cases/validation/cli/cli-usage-errors/tts-usage.test.ts')
  return path === unsupportedSourceFixturePath
    ? withoutActiveRun.split(legacyControlFilenames.at(-1) ?? '').join('')
    : withoutActiveRun
}

export const collectLegacySurfaceViolations = (path: string, rawContent: string, repositoryRoot: string): string[] => {
  const content = normalizeLegacyScanContent(path, rawContent, repositoryRoot)
  const displayPath = relative(repositoryRoot, path)
  const filenameViolations = [...content.matchAll(legacyFilenameRegex)].map((match) => {
    const filename = match[0].slice((match[1] ?? '').length)
    return `${displayPath}:${lineNumberFor(content, match.index ?? 0)} references ${filename}`
  })
  const basenameViolations = legacyControlFilenames
    .filter(filename => basename(path) === filename)
    .map(filename => `${displayPath} uses the retired control filename ${filename}`)
  const tokenViolations = [...content.matchAll(legacyTokenRegex)].map(match =>
    `${displayPath}:${lineNumberFor(content, match.index ?? 0)} references ${match[0]}`
  )
  const resumeFieldViolations = scansResumeRecordFields(path)
    ? [...content.matchAll(legacyResumeRecordFieldRegex)].map(match =>
        `${displayPath}:${lineNumberFor(content, match.index ?? 0)} references ${legacyResumeRecordField}`
      )
    : []

  return [...filenameViolations, ...basenameViolations, ...tokenViolations, ...resumeFieldViolations]
}
