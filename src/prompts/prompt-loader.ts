import type { DirectoryEntry } from '~/types'
import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import * as v from 'valibot'
import type { LeafPrompt, PromptEntry, PromptExampleFormat, PromptExamples, PromptsRegistry, PromptTokenEstimate, ResolvedLeafPrompt } from '~/types'
import { BoundedTextCapture, buildCaptureMetadata } from '~/utils/bounded-capture'
import { AppError, UsageError, hasErrorCode } from '~/utils/error-handler'
import { IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'
import { listEmbeddedAssetPaths } from '~/utils/embedded-assets'
import { validateData } from '~/utils/validate/validation'

const MARKDOWN_EXAMPLE_PRESENTATION_PREFIX = 'Format the output like so:'

export const LeafPromptSchema = v.object({
  description: v.string(),
  expectedInputTokens: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expectedOutputTokens: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instruction: v.string(),
  examples: v.object({
    json: v.string(),
    markdown: v.pipe(
      v.string(),
      v.check(
        example => !example.trimStart().startsWith(MARKDOWN_EXAMPLE_PRESENTATION_PREFIX),
        `Markdown prompt examples must not begin with "${MARKDOWN_EXAMPLE_PRESENTATION_PREFIX}"`
      )
    )
  }),
  structuredPreset: v.optional(v.string(), undefined)
})

const CompositePromptSchema = v.object({
  description: v.string(),
  includes: v.array(v.string())
})

const PromptEntrySchema = v.union([LeafPromptSchema, CompositePromptSchema])
const PromptsRegistrySchema = v.record(v.string(), PromptEntrySchema)

const PROMPTS_DIR = resolve(IMMUTABLE_ASSET_ROOT, 'src/prompts/entries')
const PROMPT_FILE_EXTENSION = '.json'
const EMBEDDED_PROMPT_DIRECTORIES = [
  'chapters',
  'creative-writing',
  'marketing-content',
  'social-media',
  'song-lyrics',
  'summary-and-overview'
]

let cachedRegistry: PromptsRegistry | undefined

const collectPromptFilePaths = async (directory: string): Promise<string[]> => {
  if (directory === PROMPTS_DIR) {
    const embedded = Bun.isStandaloneExecutable
      ? EMBEDDED_PROMPT_DIRECTORIES.flatMap((name) =>
        listEmbeddedAssetPaths(resolve(IMMUTABLE_ASSET_ROOT, name), PROMPT_FILE_EXTENSION))
      : []
    if (embedded.length > 0) return embedded
  }
  let dirEntries: DirectoryEntry[]
  try {
    dirEntries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (directory === PROMPTS_DIR && hasErrorCode(error, 'ENOENT')) {
      throw new AppError(`Prompts registry directory not found at ${PROMPTS_DIR}`, {
        kind: 'infrastructure',
        stage: 'prompts:registry',
        cause: error instanceof Error ? error : new Error(String(error)),
        metadata: { directory: PROMPTS_DIR }
      })
    }

    throw new AppError(`Failed to read prompts registry directory at ${directory}`, {
      kind: 'infrastructure',
      stage: 'prompts:registry',
      cause: error instanceof Error ? error : new Error(String(error)),
      metadata: { directory }
    })
  }

  const nestedPaths = await Promise.all(dirEntries.map(async (dirEntry) => {
    const entryPath = resolve(directory, dirEntry.name)

    if (dirEntry.isDirectory()) {
      return collectPromptFilePaths(entryPath)
    }

    if (dirEntry.isFile() && dirEntry.name.endsWith(PROMPT_FILE_EXTENSION)) {
      return [entryPath]
    }

    return []
  }))

  return nestedPaths.flat().sort((a, b) => a.localeCompare(b))
}

const getPromptNameFromPath = (filePath: string): string =>
  basename(filePath, PROMPT_FILE_EXTENSION)

const assertUniquePromptBasenames = (promptFiles: string[]): void => {
  const promptNameToPath = new Map<string, string>()

  for (const filePath of promptFiles) {
    const promptName = getPromptNameFromPath(filePath)
    const existingPath = promptNameToPath.get(promptName)

    if (existingPath !== undefined) {
      throw new AppError(
        `Duplicate prompt entry basename "${promptName}" found at ${existingPath} and ${filePath}. ` +
        `Prompt names are derived from JSON file basenames, so each prompt filename must be unique across ${PROMPTS_DIR}.`,
        {
          kind: 'validation',
          stage: 'prompts:registry',
          metadata: { promptName, existingPath, filePath, promptsDir: PROMPTS_DIR }
        }
      )
    }

    promptNameToPath.set(promptName, filePath)
  }
}

const isLeaf = (entry: PromptEntry): entry is LeafPrompt => 'instruction' in entry

const getPromptExample = (examples: PromptExamples, exampleFormat: PromptExampleFormat): string =>
  examples[exampleFormat]

const normalizeExampleText = (
  example: string,
  exampleFormat: PromptExampleFormat
): string => exampleFormat === 'markdown'
  ? example.trimEnd()
  : example.trim()

const tryBuildCombinedJsonExample = (leaves: ResolvedLeafPrompt[]): string | undefined => {
  if (leaves.length <= 1) {
    return undefined
  }

  try {
    const combined = Object.fromEntries(
      leaves.map(({ name, entry }) => [name, JSON.parse(normalizeExampleText(entry.examples.json, 'json'))])
    )
    return JSON.stringify(combined, null, 2)
  } catch {
    return undefined
  }
}

const buildExamplesText = (
  leaves: ResolvedLeafPrompt[],
  exampleFormat: PromptExampleFormat
): string => {
  const normalizedExamples = leaves
    .map(({ entry }) => normalizeExampleText(getPromptExample(entry.examples, exampleFormat), exampleFormat))
    .filter((example) => example.length > 0)

  if (normalizedExamples.length === 0) {
    return ''
  }

  if (exampleFormat === 'markdown') {
    return `Format the output like so:\n\n${normalizedExamples.join('\n\n')}`
  }

  const combinedJsonExample = tryBuildCombinedJsonExample(leaves)
  if (combinedJsonExample) {
    return `Example JSON output:\n\n${combinedJsonExample}`
  }

  return `Example JSON output:\n\n${normalizedExamples[0]}`
}

const resolveRequestedPromptNames = (
  names: string[],
  fallbackToDefault: boolean
): string[] =>
  names.length === 0
    ? (fallbackToDefault ? ['default'] : [])
    : names

const collectLeafPromptsFromRegistry = (
  registry: PromptsRegistry,
  names: string[],
  fallbackToDefault: boolean
): ResolvedLeafPrompt[] => {
  const available = Object.keys(registry)
  const resolved = resolveRequestedPromptNames(names, fallbackToDefault)
  const leaves: ResolvedLeafPrompt[] = []
  const seen = new Set<string>()

  const collect = (name: string, stack: string[]): void => {
    if (stack.includes(name)) {
      throw new AppError(`Circular prompt include detected: ${[...stack, name].join(' → ')}`, {
        kind: 'validation',
        stage: 'prompts:registry',
        metadata: { promptName: name, includeStack: [...stack, name] }
      })
    }

    if (!registry[name]) {
      throw UsageError(`Unknown prompt "${name}". Available: ${available.join(', ')}`)
    }

    const entry = registry[name] as PromptEntry

    if (isLeaf(entry)) {
      if (!seen.has(name)) {
        seen.add(name)
        leaves.push({ name, entry })
      }
      return
    }

    for (const child of entry.includes) {
      collect(child, [...stack, name])
    }
  }

  for (const name of resolved) {
    collect(name, [])
  }

  return leaves
}

const loadPrompts = async (): Promise<PromptsRegistry> => {
  if (cachedRegistry !== undefined) return cachedRegistry

  const promptFiles = await collectPromptFilePaths(PROMPTS_DIR)

  if (promptFiles.length === 0) {
    throw new AppError(`Prompts registry directory at ${PROMPTS_DIR} contains no .json files`, {
      kind: 'validation',
      stage: 'prompts:registry',
      metadata: { promptsDir: PROMPTS_DIR }
    })
  }

  assertUniquePromptBasenames(promptFiles)

  const rawEntries = await Promise.all(promptFiles.map(async (filePath) => {
    let fileContents: string
    try {
      fileContents = await readFile(filePath, 'utf8')
    } catch (error) {
      throw new AppError(`Failed to read prompt entry at ${filePath}`, {
        kind: 'infrastructure',
        stage: 'prompts:registry',
        cause: error instanceof Error ? error : new Error(String(error)),
        metadata: { filePath }
      })
    }

    let rawEntry: unknown
    try {
      rawEntry = JSON.parse(fileContents) as unknown
    } catch (error) {
      const capture = new BoundedTextCapture({ maxBytes: 8 * 1024 })
      capture.append(fileContents)
      throw new AppError(`Failed to parse prompt entry at ${filePath}: invalid JSON`, {
        kind: 'validation',
        stage: 'prompts:registry',
        cause: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          filePath,
          ...buildCaptureMetadata(capture.result(), 'promptFile')
        }
      })
    }

    const entry = validateData(PromptEntrySchema, rawEntry, `prompt entry at ${filePath}`)
    const promptName = getPromptNameFromPath(filePath)

    return [promptName, entry] as const
  }))

  const rawRegistry = Object.fromEntries(rawEntries)
  const validated = validateData(PromptsRegistrySchema, rawRegistry, `prompts registry assembled from ${PROMPTS_DIR}`)
  cachedRegistry = validated
  return validated
}

export const resolvePromptNames = async (
  names: string[],
  options: { exampleFormat?: PromptExampleFormat, fallbackToDefault?: boolean } = {}
): Promise<string> => {
  const registry = await loadPrompts()
  const exampleFormat = options.exampleFormat ?? 'json'
  const fallbackToDefault = options.fallbackToDefault ?? true
  const leaves = collectLeafPromptsFromRegistry(registry, names, fallbackToDefault)

  const instructionsText = leaves
    .map(({ entry }) => entry.instruction.trim())
    .filter((instruction) => instruction.length > 0)
    .join('\n\n')

  const examplesText = buildExamplesText(leaves, exampleFormat)

  return [instructionsText, examplesText]
    .filter((section) => section.length > 0)
    .join('\n\n')
}

export const resolvePromptTokenEstimate = async (
  names: string[],
  options: { fallbackToDefault?: boolean } = {}
): Promise<PromptTokenEstimate> => {
  const registry = await loadPrompts()
  const fallbackToDefault = options.fallbackToDefault ?? true
  const leaves = collectLeafPromptsFromRegistry(registry, names, fallbackToDefault)

  const estimatedInputTokens = leaves.reduce((sum, leaf) => sum + leaf.entry.expectedInputTokens, 0)
  const estimatedOutputTokens = leaves.reduce((sum, leaf) => sum + leaf.entry.expectedOutputTokens, 0)

  return {
    estimatedInputTokens,
    estimatedOutputTokens
  }
}

export const getAvailablePromptNames = async (): Promise<string[]> => {
  const registry = await loadPrompts()
  return Object.keys(registry)
}

export const collectLeafPrompts = async (names: string[]): Promise<ResolvedLeafPrompt[]> => {
  const registry = await loadPrompts()
  return collectLeafPromptsFromRegistry(registry, names, true)
}
