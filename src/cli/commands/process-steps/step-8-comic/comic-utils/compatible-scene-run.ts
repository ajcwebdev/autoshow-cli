import { mkdir, readdir, readFile } from 'node:fs/promises'
import { statPath as stat } from '~/utils/bun-file-io'
import { join, resolve } from 'node:path'
import * as v from 'valibot'
import type { CanonicalComicItemMetadata, ComicSourceIdentity, CompatibleComicSceneRun } from '~/types'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { getPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { StructuredScriptDataSchema } from '../schemas/schemas'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { computeSceneRunIdentity, createComicSourceIdentity, createStructuredScriptArtifactRef, validateComicSourceIdentity, validateStructuredScriptSourceSpans } from './comic-audio-contracts'
import { parseScriptMarkdownToStructuredData } from './structured-script-utils/structured-script-parser'
import { writeInitialComicStructureManifest } from './comic-manifest'

const RUN_DIRECTORY_PREFIX = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_/

const initializeWorkspaceDir = async (
  sceneRunDir: string,
  sourceIdentity: ComicSourceIdentity,
  exactSourceText: string
): Promise<CompatibleComicSceneRun> => {
  await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
  await mkdir(join(sceneRunDir, 'panels'), { recursive: true })
  let structuredScript = parseScriptMarkdownToStructuredData(exactSourceText, sourceIdentity.canonicalPath, { sourceIdentity })
  structuredScript = validateStructuredScriptSourceSpans(structuredScript, exactSourceText)
  const structuredPath = join(sceneRunDir, 'metadata/structured-script.json')
  const bytes = Buffer.from(`${JSON.stringify(structuredScript, null, 2)}\n`)
  await Bun.write(structuredPath, bytes)
  const structuredRef = createStructuredScriptArtifactRef(bytes)
  const manifest = await writeInitialComicStructureManifest({
    sceneRunDir,
    createdAt: new Date().toISOString(),
    sourceIdentity,
    structuredScript: structuredRef,
  })
  const item = manifest.items[0]
  if (!item) throw CLIUsageError('Failed to initialize manifest item')
  const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
  return {
    sceneRunDir,
    manifest,
    sourceIdentity,
    structuredScript,
    structuredScriptBytes: new Uint8Array(bytes),
    comicMetadata: comic,
  }
}

const inspectCandidate = async (
  sceneRunDir: string,
  sourceIdentity: ComicSourceIdentity,
  exactSourceText: string
): Promise<CompatibleComicSceneRun> => {
  const manifest = await readManifest(sceneRunDir)
  if (!manifest || manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1) throw CLIUsageError('candidate has no strict canonical comic manifest')
  if (canonicalTtsJson(manifest.source) !== canonicalTtsJson(sourceIdentity)) throw CLIUsageError('candidate source identity does not match the exact source bytes/path')
  const item = manifest.items[0]
  if (!item || item.input !== sourceIdentity.canonicalPath || item.outputDir !== '.') throw CLIUsageError('candidate canonical item does not bind the source path and scene root')
  const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
  const structuredRef = comic.audio.structuredScript
  if (!structuredRef || structuredRef.artifactSchemaVersion !== 5) throw CLIUsageError('candidate does not retain structured-script v5')
  const structuredPath = join(sceneRunDir, structuredRef.path)
  const bytes = new Uint8Array(await readFile(structuredPath))
  if (sha256Bytes(bytes) !== structuredRef.sha256) throw CLIUsageError('candidate structured script checksum does not match canonical state')
  const structuredScript = v.parse(StructuredScriptDataSchema, JSON.parse(new TextDecoder().decode(bytes)))
  validateComicSourceIdentity(structuredScript.sourceIdentity)
  validateStructuredScriptSourceSpans(structuredScript, exactSourceText)
  if (canonicalTtsJson(structuredScript.sourceIdentity) !== canonicalTtsJson(sourceIdentity)) throw CLIUsageError('candidate structured script embeds another source identity')
  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
  if (comic.audio.sceneRunIdentity !== sceneRunIdentity) throw CLIUsageError('candidate scene-run identity does not bind its source and structured artifact')
  return { sceneRunDir, manifest, sourceIdentity, structuredScript, structuredScriptBytes: bytes, comicMetadata: comic }
}

export const resolveCompatibleComicSceneRun = async (input: {
  scriptPath: string
  outputDir?: string | undefined
  outputRoot?: string | undefined
}): Promise<CompatibleComicSceneRun> => {
  const sourceBytes = new Uint8Array(await Bun.file(input.scriptPath).arrayBuffer())
  const exactSourceText = new TextDecoder().decode(sourceBytes)
  const sourceIdentity = await createComicSourceIdentity(input.scriptPath, sourceBytes)
  const pinned = input.outputDir ?? getPinnedRunDir()
  if (pinned) {
    const directory = resolve(pinned)
    try {
      const info = await stat(directory).catch(() => null)
      if (info && info.isDirectory()) {
        const entries = await readdir(directory)
        if (entries.length === 0) return await initializeWorkspaceDir(directory, sourceIdentity, exactSourceText)
        return await inspectCandidate(directory, sourceIdentity, exactSourceText)
      }
      if (info) throw CLIUsageError('pinned path exists but is not a directory')
      return await initializeWorkspaceDir(directory, sourceIdentity, exactSourceText)
    } catch (error) {
      throw CLIUsageError(`Pinned comic output is not compatible with the exact source and structured-script v5: ${error instanceof Error ? error.message : String(error)}`, undefined, error instanceof Error ? { cause: error } : {})
    }
  }

  const outputRoot = resolve(input.outputRoot ?? getOutputRoot())
  const sanitizedSlug = sanitizeTitleSlug(sourceIdentity.scriptSlug)
  const entries = await readdir(outputRoot, { withFileTypes: true }).catch(() => [])
  const candidates = entries
    .filter(entry => entry.isDirectory() && RUN_DIRECTORY_PREFIX.test(entry.name) && entry.name.replace(RUN_DIRECTORY_PREFIX, '') === sanitizedSlug)
    .map(entry => join(outputRoot, entry.name))
    .sort((left, right) => right.localeCompare(left))
  const rejected: string[] = []
  for (const candidate of candidates) {
    try {
      return await inspectCandidate(candidate, sourceIdentity, exactSourceText)
    } catch (error) {
      rejected.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw CLIUsageError(
    `No compatible existing comic scene run was found for ${sourceIdentity.canonicalPath}. Run comic draft-scenes first; this downstream workflow never creates a fresh scene run.`,
    ...(rejected.length > 0 ? [`Skipped incompatible candidates: ${rejected.join('; ')}`] : [])
  )
}
