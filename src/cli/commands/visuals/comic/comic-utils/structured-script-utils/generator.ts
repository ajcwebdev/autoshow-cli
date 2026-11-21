import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { PreparedStructuredScript, StructuredScriptRunStats } from '~/types'
import { comicLog, err } from '../comic-logger'
import { getSceneOutputDirectory, getStructuredScriptPath } from '../project-paths'
import { parseScriptMarkdownToStructuredData } from './structured-script-parser'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, validateStructuredScriptSourceSpans } from '../comic-audio-contracts'
import { writeInitialComicStructureManifest } from '../comic-manifest'

/** Parses a script locally and validates its source spans without writing anything. Returns undefined for an empty script. */
export const prepareStructuredScript = async (scriptPath: string): Promise<PreparedStructuredScript | undefined> => {
  try {
    const sourceBytes = new Uint8Array(await Bun.file(scriptPath).arrayBuffer())
    const content = new TextDecoder().decode(sourceBytes)
    if (!content.trim()) {
      comicLog.line(`Skipping empty file: ${basename(scriptPath)}`)
      return undefined
    }
    const sourceIdentity = await createComicSourceIdentity(scriptPath, sourceBytes)
    const structuredScript = validateStructuredScriptSourceSpans(parseScriptMarkdownToStructuredData(content, scriptPath, { sourceIdentity }), content)
    return { scriptPath, sourceIdentity, structuredScript, structuredBytes: `${JSON.stringify(structuredScript, null, 2)}\n` }
  } catch (error) {
    if (v.isValiError(error)) {
      err(`Invalid structured script output for ${basename(scriptPath)}`)
      err(error)
    } else {
      err(`Failed to process ${basename(scriptPath)}:`, error instanceof Error ? error.message : String(error))
    }
    throw error
  }
}

/** Writes metadata/structured-script.json and the initial structure manifest for a prepared structure. */
export const publishStructuredScript = async (sceneSlug: string, prepared: PreparedStructuredScript): Promise<string> => {
  const outputPath = getStructuredScriptPath(sceneSlug)
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, prepared.structuredBytes)
  await writeInitialComicStructureManifest({
    sceneRunDir: getSceneOutputDirectory(sceneSlug),
    createdAt: new Date().toISOString(),
    sourceIdentity: prepared.sourceIdentity,
    structuredScript: createStructuredScriptArtifactRef(prepared.structuredBytes),
  })
  comicLog.line('structured-script generated', [`source=${basename(prepared.scriptPath)}`, `file=${basename(outputPath)}`])
  return outputPath
}

/** Local parse and publish with no model or hosted-concurrency options. */
export const generateStructuredScript = async (scriptPath: string, sceneSlug: string): Promise<StructuredScriptRunStats> => {
  const startedAt = performance.now()
  const prepared = await prepareStructuredScript(scriptPath)
  if (!prepared) return { filesProcessed: 0, totalDurationMs: 0 }
  await publishStructuredScript(sceneSlug, prepared)
  return { filesProcessed: 1, totalDurationMs: performance.now() - startedAt }
}
