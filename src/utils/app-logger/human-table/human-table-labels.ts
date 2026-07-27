import type { HumanLogTable } from '~/types'

const pathLikeColumnNames = new Set<string>([
  'batchmanifest',
  'cachedir',
  'destination',
  'dir',
  'directory',
  'file',
  'filename',
  'input',
  'inputdir',
  'inputpath',
  'location',
  'manifest',
  'output',
  'outputdir',
  'outputpath',
  'path',
  'retryoutputdir',
  'runmanifest',
  'source',
  'sourcemedia',
  'sourcepath',
  'target',
  'targetpath',
  'workdir'
])

const alwaysLiftVerboseColumnNames = new Set<string>([
  'error',
  'errors',
  'lasterror',
  'stderr',
  'stdout',
  'stack'
])

const conditionallyLiftVerboseColumnNames = new Set<string>([
  'detail',
  'details',
  'message',
  'messages'
])

const humanLabelOverrides = new Map<string, string>([
  ['batchmanifest', 'batch manifest'],
  ['cachedir', 'cache dir'],
  ['durationms', 'duration'],
  ['elapsedms', 'elapsed'],
  ['estimatedtime', 'estimated'],
  ['inputdir', 'input dir'],
  ['inputpath', 'input path'],
  ['outputcount', 'outputs'],
  ['outputdir', 'output dir'],
  ['outputpath', 'output path'],
  ['processingtime', 'time'],
  ['processingtimems', 'time'],
  ['providermodel', 'provider/model'],
  ['retryoutputdir', 'retry output dir'],
  ['runmanifest', 'run manifest'],
  ['sourcemedia', 'source media'],
  ['sourcepath', 'source path'],
  ['targetpath', 'target path'],
  ['totalestimatedcost', 'total estimated cost'],
  ['totalestimatedprocessingtime', 'total estimated processing time'],
  ['totalprocessingtime', 'total processing time']
])

export const normalizeColumnName = (column: string): string =>
  column.trim().replace(/[^a-z0-9]+/gi, '').toLowerCase()

const humanizeIdentifier = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return trimmed
  }

  if (/\s/.test(trimmed)) {
    return trimmed
  }

  const override = humanLabelOverrides.get(normalizeColumnName(trimmed))
  if (override) {
    return override
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
}

export const getDisplayLabel = (table: HumanLogTable, label: string): string =>
  table.labels?.[label] ?? humanizeIdentifier(label)

export const isAlwaysLiftVerboseColumnName = (column: string): boolean =>
  alwaysLiftVerboseColumnNames.has(normalizeColumnName(column))

export const isConditionallyLiftVerboseColumnName = (column: string): boolean =>
  conditionallyLiftVerboseColumnNames.has(normalizeColumnName(column))

export const isPathLikeColumnName = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return pathLikeColumnNames.has(normalized)
    || normalized.endsWith('path')
    || normalized.endsWith('paths')
    || normalized.endsWith('dir')
    || normalized.endsWith('dirs')
    || normalized.endsWith('directory')
    || normalized.endsWith('directories')
    || normalized.endsWith('manifest')
    || normalized.endsWith('manifests')
    || normalized.includes('manifest')
}

export const isDurationSemanticColumn = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return normalized.includes('duration')
    || normalized.includes('processingtime')
    || normalized.includes('elapsed')
    || normalized.includes('latency')
    || normalized.endsWith('time')
    || normalized.endsWith('ms')
}

export const isSecondsSemanticColumn = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return normalized.endsWith('seconds') || normalized.endsWith('secs')
}

export const isCostSemanticColumn = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return normalized.includes('cost')
    || normalized.includes('price')
    || normalized.includes('cents')
}

export const isCountSemanticColumn = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return normalized === 'total'
    || normalized === 'count'
    || normalized.endsWith('count')
    || normalized.endsWith('counts')
    || normalized.endsWith('chunks')
    || normalized.endsWith('images')
    || normalized.endsWith('outputs')
    || normalized.endsWith('attempt')
    || normalized.endsWith('attempts')
    || normalized.endsWith('pages')
    || normalized.endsWith('tokens')
    || normalized.endsWith('characters')
}
