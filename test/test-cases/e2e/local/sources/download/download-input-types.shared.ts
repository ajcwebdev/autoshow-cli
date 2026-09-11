import { test, expect, beforeAll, afterAll } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { assertDownloadOnly, assertDownloadRecord, downloadScenarios, PUBLIC_DOWNLOADS, DOWNLOAD_TIMESTAMPED_CHILD_DIR_PATTERN } from '../../../../../scenarios/local-cli-contracts'
import { basename, dirname, join, resolve } from 'node:path'
import { cleanupOutputDir, cleanupTestOutput, fileExists, findLatestDirectory } from '../../../../../test-utils/test-helpers'
import { createNativeScenarioAdapter } from '../../../../../test-utils/native-scenario-adapter'
import { readCanonicalItemRecords, readCanonicalSource, readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { expectArtifact } from '../../../../../test-utils/value-assertions'
import type {
  DownloadE2eBatchCase,
  DownloadE2eBatchSource,
  DownloadE2eCaseInput,
  DownloadE2eMetadata,
  DownloadE2eSingleCase,
  DownloadE2eStep1Metadata
} from '~/types'

const createdDirs = new Set<string>()

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return value as Record<string, unknown>
}

const asString = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

const asNumber = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined

const withDefined = <T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void => {
  if (value !== undefined) {
    target[key] = value
  }
}

const resolveCaseInput = async (input: DownloadE2eCaseInput): Promise<string> =>
  typeof input === 'function' ? await input() : input

const parseMetadata = (value: unknown): DownloadE2eMetadata => {
  const root = asRecord(value)
  if (!root) {
    return {}
  }

  const step1Record = asRecord(root['step1'])
  const output: DownloadE2eMetadata = {}
  if (step1Record) {
    const step1: DownloadE2eStep1Metadata = {}
    withDefined(step1, 'audioFileName', asString(step1Record['audioFileName']))
    withDefined(step1, 'audioFileSize', asNumber(step1Record['audioFileSize']))
    withDefined(step1, 'format', asString(step1Record['format']))
    withDefined(step1, 'pageCount', asNumber(step1Record['pageCount']))
    withDefined(step1, 'fileSize', asNumber(step1Record['fileSize']))
    withDefined(step1, 'title', asString(step1Record['title']))
    withDefined(step1, 'channel', asString(step1Record['channel']))
    withDefined(step1, 'slug', asString(step1Record['slug']))
    output.step1 = step1
  }
  if ('step2' in root) {
    output.step2 = root['step2']
  }
  if ('step3' in root) {
    output.step3 = root['step3']
  }
  return output
}

const parseBatchSource = (value: unknown): DownloadE2eBatchSource => {
  const root = asRecord(value)
  if (!root) {
    return {}
  }
  const source: DownloadE2eBatchSource = {}
  withDefined(source, 'sourceKind', asString(root['sourceKind']))
  withDefined(source, 'selectedCount', asNumber(root['selectedCount']))
  return source
}

const rememberDir = (dir: string): void => {
  createdDirs.add(dir)
}

const normalizeOutputDir = (dir: string): string =>
  dir.replace(/\\/g, '/').replace(/^\.\//, '')

const findNewestDirInRoot = async (outputRoot: string): Promise<string | null> => {
  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => join(outputRoot, entry.name)).sort()
    return dirs.at(-1) ?? null
  } catch {
    return null
  }
}

const resolveSingleOutputDir = async (
  result: { outputDir: string | null, outputRoot: string },
  suffix?: string
): Promise<string | null> => {
  if (result.outputDir) {
    rememberDir(result.outputDir)
    return result.outputDir
  }
  const latest = suffix
    ? await findLatestDirectory(suffix, result.outputRoot)
    : await findNewestDirInRoot(result.outputRoot)
  if (latest) {
    rememberDir(latest)
  }
  return latest
}

const resolveBatchOutputDir = async (
  outputDir: string | null,
  outputRoot: string
): Promise<string | null> => {
  if (outputDir) {
    const candidates = [outputDir, dirname(outputDir)]
    for (const candidate of candidates) {
      if (
        await fileExists(join(candidate, PIPELINE_MANIFEST_FILE))
        && await readCanonicalSource(candidate) !== undefined
      ) {
        rememberDir(candidate)
        return candidate
      }
    }
  }

  const latest = await findNewestDirInRoot(outputRoot)
  if (latest) {
    rememberDir(latest)
  }
  return latest
}

export const setupDownloadInputTypeLifecycle = (suffixes: string[]): void => {
  const uniqueSuffixes = Array.from(new Set(suffixes))

  beforeAll(async () => {
    await Promise.all(uniqueSuffixes.map(suffix => cleanupTestOutput(suffix)))
  })

  afterAll(async () => {
    await Promise.all([...createdDirs].map(dir => cleanupOutputDir(dir)))
    await Promise.all(uniqueSuffixes.map(suffix => cleanupTestOutput(suffix)))
  })
}

const assertDownloadOnlyArtifacts = async (outputDir: string, metadata: DownloadE2eMetadata): Promise<void> => {
  await assertDownloadOnly(outputDir, { ...metadata })
}

export const defineSingleCaseTest = (tc: DownloadE2eSingleCase): void => {
  test(tc.name, async () => {
    const input = await resolveCaseInput(tc.input)
    const result = await createNativeScenarioAdapter({}, { testName: tc.name }).execute(['download', input])
    expect(result.exitCode).toBe(0)

    const outputDir = await resolveSingleOutputDir(result, tc.suffix)
    expect(outputDir).not.toBeNull()
    if (!outputDir) {
      return
    }

    await expectArtifact(join(outputDir, PIPELINE_MANIFEST_FILE))
    const metadata = parseMetadata(await readCanonicalRecord(outputDir))
    expect(metadata.step1).toBeDefined()

    await tc.checks(metadata, outputDir)
    await assertDownloadOnlyArtifacts(outputDir, metadata)
  })
}

export const defineBatchCaseTest = (tc: DownloadE2eBatchCase): void => {
  test(tc.name, async () => {
    const input = await resolveCaseInput(tc.input)

    const result = await createNativeScenarioAdapter({}, { testName: tc.name }).execute([
      'download',
      input,
      ...tc.extraArgs,
    ])
    expect(result.exitCode).toBe(0)

    const batchDir = await resolveBatchOutputDir(result.outputDir, result.outputRoot)
    expect(batchDir).not.toBeNull()
    if (!batchDir) {
      return
    }

    await expectArtifact(join(batchDir, PIPELINE_MANIFEST_FILE))
    const infoEntries = await readCanonicalItemRecords(batchDir)

    const canonicalSource = await readCanonicalSource(batchDir)
    expect(canonicalSource).toBeDefined()
    const source = parseBatchSource(canonicalSource)
    expect(source.sourceKind).toBe(tc.expectedSourceKind)
    if (tc.expectedSelectedCount !== undefined) {
      expect(source.selectedCount).toBe(tc.expectedSelectedCount)
    } else {
      expect((source.selectedCount ?? 0) > 0).toBe(true)
    }

    const itemDirs = (await readdir(batchDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => join(batchDir, entry.name))
      .sort()
    for (const itemDir of itemDirs) {
      expect(basename(itemDir)).not.toMatch(DOWNLOAD_TIMESTAMPED_CHILD_DIR_PATTERN)
    }
    if (tc.expectedSelectedCount !== undefined) {
      expect(itemDirs.length).toBe(tc.expectedSelectedCount)
    } else {
      expect(itemDirs.length).toBeGreaterThan(0)
    }

    const firstItemDir = itemDirs[0]
    if (!firstItemDir) {
      return
    }

    await expectArtifact(join(firstItemDir, PIPELINE_MANIFEST_FILE))
    expect(infoEntries.length).toBe(itemDirs.length)
    const rawMetadata = await readCanonicalRecord(firstItemDir)
    const firstInfoEntry = asRecord(infoEntries[0])
    expect(firstInfoEntry).not.toBeNull()
    if (!firstInfoEntry) {
      return
    }
    const normalizedInfoEntry = {
      ...firstInfoEntry,
      outputDir: typeof firstInfoEntry['outputDir'] === 'string'
        ? normalizeOutputDir(firstInfoEntry['outputDir'])
        : firstInfoEntry['outputDir']
    }
    expect(normalizedInfoEntry).toMatchObject({
      ...rawMetadata,
      outputDir: normalizeOutputDir(resolve(firstItemDir))
    })
    const metadata = parseMetadata(await readCanonicalRecord(firstItemDir))
    expect(metadata.step1).toBeDefined()
    await assertDownloadOnlyArtifacts(firstItemDir, metadata)
  })
}

export function defineSharedDownloadCases(ids: string[], feed: () => string = () => ''): void {
  const fixture = (name: string): string => ({ audio: 'input/examples/audio/1-audio.mp3', pdf: 'input/examples/document/1-document.pdf', urls: 'input/examples/batch/2-direct-urls.md' }[name] ?? '')
  const cases = downloadScenarios(fixture, PUBLIC_DOWNLOADS, feed()).filter(item => ids.includes(item.id))
  if (cases.length === 0 || cases.length !== ids.length) throw new Error('Missing native download scenarios')
  for (const scenario of cases) {
    if (scenario.batch) {
      defineBatchCaseTest({ name: scenario.name, input: scenario.kind === 'podcast_rss' ? feed : scenario.input, extraArgs: scenario.args, expectedSourceKind: scenario.kind as 'url_list' | 'podcast_rss', expectedSelectedCount: 1 })
    } else {
      defineSingleCaseTest({
        name: scenario.name, input: scenario.input,
        checks: async (metadata, dir) => {
          await assertDownloadRecord(scenario.kind, metadata, dir)
          if (scenario.id === 'download-local-audio') expect(metadata.step1?.slug).toBe('1-audio')
          if (scenario.id === 'download-local-document') expect(metadata.step1?.slug).toBe('1-document')
        }
      })
    }
  }
}
