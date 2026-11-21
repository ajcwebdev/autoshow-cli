import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { existsSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { CanonicalComicItemMetadata, ComicSceneCommandOptionsBase, PreparedSceneArtifacts, PreparedScenePair, PrepareSceneResult, StructuredScriptData } from '~/types'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { comicLog } from '../../comic-utils/comic-logger'
import { assertSceneRunSourceOwnership } from '../../comic-utils/compatible-scene-run'
import { buildDraftPrompt } from '../../comic-utils/json-prompt-utils'
import { getDraftPromptPath, getSceneOutputDirectory, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { prepareStructuredScript, publishStructuredScript } from '../../comic-utils/structured-script-utils/generator'
import { StructuredScriptDataSchema } from '../../schemas/schemas'

const STAGE = 'comic:draft-scenes:prepare'

const PREPARE_HINT = `run "${CLI_INVOCATION} comic draft-scenes <script-path> --only prepare" first`

const LEGACY_BLOCKING_PLAN_SECTION = '## Scene blocking plan (authoritative stage marks and cameras)'

const formatStructuredScriptJsonBlock = (structuredScript: StructuredScriptData): string =>
  `\`\`\`json\n${JSON.stringify(structuredScript, null, 2)}\n\`\`\``

/** Parse the script locally and build the draft prompt from that exact structure, without writing anything. */
export const buildPreparedScene = async (scriptPath: string): Promise<PreparedSceneArtifacts> => {
  const structure = await prepareStructuredScript(scriptPath)
  if (!structure) throw ValidationError(`Comic script is empty: ${scriptPath}`, { stage: STAGE })
  // Build the prompt from the published bytes, exactly as scene drafting reads them back.
  const structuredScript = v.parse(StructuredScriptDataSchema, JSON.parse(structure.structuredBytes))
  const { content: draftPrompt, recapMontages } = await buildDraftPrompt(structuredScript)
  if (!draftPrompt.includes(formatStructuredScriptJsonBlock(structuredScript))) {
    throw ValidationError('The draft prompt does not embed its structured script verbatim; refusing to publish an unbound pair.', { stage: STAGE })
  }
  return { structure, structuredScript, draftPrompt, recapMontages }
}

/** Publish metadata/structured-script.json, metadata/draft-prompt.md and the manifest reference as one bound pair. */
export const prepareSceneCommand = async (options: ComicSceneCommandOptionsBase & { scriptPath: string }): Promise<PrepareSceneResult> => {
  const startTime = Date.now()
  const prepared = await buildPreparedScene(options.scriptPath)
  const sceneRunDir = getSceneOutputDirectory(options.sceneSlug)
  await assertSceneRunSourceOwnership(sceneRunDir, prepared.structure.sourceIdentity)

  const draftPromptPath = getDraftPromptPath(options.sceneSlug)
  await mkdir(dirname(draftPromptPath), { recursive: true })
  const temporaryPromptPath = `${draftPromptPath}.${process.pid}-${Date.now()}.tmp`
  let structuredScriptPath: string
  try {
    await Bun.write(temporaryPromptPath, prepared.draftPrompt)
    // A failure between these writes leaves an unbound pair, which scene drafting rejects before any paid call.
    structuredScriptPath = await publishStructuredScript(options.sceneSlug, prepared.structure)
    await rename(temporaryPromptPath, draftPromptPath)
  } finally {
    await rm(temporaryPromptPath, { force: true })
  }
  comicLog.line('draft-prompt generated', [
    `file=${basename(draftPromptPath)}`,
    `sourceSegments=${prepared.structuredScript.sourceSegments.length}`,
    prepared.recapMontages > 0 ? `recapMontages=${prepared.recapMontages}` : undefined,
  ])
  return { structuredScriptPath, draftPromptPath, sourceSegments: prepared.structuredScript.sourceSegments.length, durationMs: Date.now() - startTime }
}

const readStructuredScriptManifestSha256 = async (sceneRunDir: string): Promise<string | undefined> => {
  const manifest = await readManifest(sceneRunDir, { verifyArtifacts: false })
  const comic = manifest?.items[0]?.metadata['comic'] as CanonicalComicItemMetadata | undefined
  return comic?.audio?.structuredScript?.sha256
}

/** Read the prepared pair and verify the prompt was built from the current structure before any paid drafting. */
export const readPreparedScenePair = async (sceneSlug: string): Promise<PreparedScenePair> => {
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  const draftPromptPath = getDraftPromptPath(sceneSlug)
  for (const path of [structuredScriptPath, draftPromptPath]) {
    if (!existsSync(path)) throw ValidationError(`Prepared scene input not found at ${path}; ${PREPARE_HINT}.`, { stage: STAGE })
  }
  const structuredBytes = new Uint8Array(await Bun.file(structuredScriptPath).arrayBuffer())
  let structuredScript: StructuredScriptData
  try {
    structuredScript = v.parse(StructuredScriptDataSchema, JSON.parse(new TextDecoder().decode(structuredBytes)))
  } catch (error) {
    throw ValidationError(`Invalid structured script at ${structuredScriptPath}; ${PREPARE_HINT}.`, { stage: STAGE, ...(error instanceof Error ? { cause: error } : {}) })
  }
  const draftPrompt = await Bun.file(draftPromptPath).text()
  if (!draftPrompt.includes(formatStructuredScriptJsonBlock(structuredScript))) {
    throw ValidationError(`${draftPromptPath} was not built from the current ${structuredScriptPath}; ${PREPARE_HINT}.`, { stage: STAGE })
  }
  if (draftPrompt.includes(LEGACY_BLOCKING_PLAN_SECTION)) {
    throw ValidationError(`${draftPromptPath} carries a retired blocking plan section; ${PREPARE_HINT} to rebuild it without the plan.`, { stage: STAGE })
  }
  const manifestSha256 = await readStructuredScriptManifestSha256(getSceneOutputDirectory(sceneSlug))
  if (manifestSha256 !== undefined && manifestSha256 !== sha256Bytes(structuredBytes)) {
    throw ValidationError(`${structuredScriptPath} does not match the structured script recorded in the scene manifest; ${PREPARE_HINT}.`, { stage: STAGE })
  }
  return { structuredScript, structuredScriptPath, draftPrompt, draftPromptPath }
}
