const E2E_PREFIX = 'test/test-cases/e2e/'
const TEST_CASES_PREFIX = 'test/test-cases/'

const normalizePathFilter = (pathFilter: string): string => {
  return pathFilter
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}

const matchPathFilters = (file: string, pathFilters: string[]): boolean => {
  return pathFilters.some(pathFilter => {
    const normalizedFilter = normalizePathFilter(pathFilter)
    const prefix = normalizedFilter.endsWith('/') ? normalizedFilter : `${normalizedFilter}/`
    return file === normalizedFilter || file.startsWith(prefix)
  })
}

export const resolveSelectedFiles = (allFiles: string[], pathFilters: string[]): string[] => {
  if (pathFilters.length === 0) {
    return allFiles
  }

  const selectedFiles = allFiles.filter(file => matchPathFilters(file, pathFilters))
  if (selectedFiles.length === 0) {
    throw new Error(`No tests matched path filters: ${pathFilters.join(', ')}`)
  }

  return selectedFiles
}

const SLOW_E2E_PATH_FRAGMENTS = [
  'ocr-services/ocr-replicate.test.ts',
  'download-input-types-streaming.test.ts',
  'stt-services/scrapecreators-youtube-transcript.test.ts',
  'step-5-image-gen-e2e/fal-image.test.ts',
  'ocr-services/deepinfra-qwen3-vl-30b-a3b-instruct.test.ts',
] as const

export const orderTestFiles = (
  files: string[],
  timings: ReadonlyMap<string, number> = new Map()
): string[] => {
  const durationFor = (file: string): number => {
    const cached = timings.get(file)
    if (cached !== undefined) {
      return cached
    }
    const seedIndex = SLOW_E2E_PATH_FRAGMENTS.findIndex((fragment) => file.endsWith(fragment))
    return seedIndex === -1 ? 0 : Number.MAX_SAFE_INTEGER - seedIndex
  }

  return files
    .map((file, index) => ({ file, index, duration: durationFor(file) }))
    .sort((left, right) => right.duration - left.duration || left.index - right.index)
    .map((entry) => entry.file)
}

const formatSelectionPath = (pathFilter: string): string => {
  const normalized = normalizePathFilter(pathFilter)
  if (normalized.startsWith(E2E_PREFIX)) {
    return normalized.slice(E2E_PREFIX.length)
  }
  if (normalized.startsWith(TEST_CASES_PREFIX)) {
    return normalized.slice(TEST_CASES_PREFIX.length)
  }
  return normalized
}

export const formatSelectedPathsLabel = (pathFilters: string[]): string => {
  return `Selected paths: ${pathFilters.map(formatSelectionPath).join(', ')}`
}
