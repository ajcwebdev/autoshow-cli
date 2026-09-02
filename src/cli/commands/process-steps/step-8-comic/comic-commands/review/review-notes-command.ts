import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogService, ReviewNote, ReviewNoteClassification, ReviewNoteDirective, ReviewNoteDirectiveLabel, ReviewNoteKind, ReviewNotesCommandDependencies, ReviewNotesCommandOptions, ReviewNoteTarget, ReviewNoteUnmatched, ReviewNotesResult, ScenePromptData, StructuredScriptData, StructuredScriptSourceSegment } from '~/types'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { getSceneJsonPath, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { getReviewDirectory, getReviewNotesPath } from './review-paths'
import { InfraError, ValidationError } from '~/utils/error-handler'

const STAGE = 'comic:review-notes'

// The catalog is optional here: mapping notes must still work when the command runs outside a loaded catalog scope.
const loadCharacterCatalogSafely = (): Pick<CharacterCatalogService, 'detectMentions'> | undefined => {
  try {
    return loadCharacterCatalog()
  } catch {
    return undefined
  }
}

export const REVIEW_NOTE_KINDS = ['blocking', 'camera', 'axis-break', 'costume', 'extras'] as const

export const REVIEW_NOTE_DIRECTIVE_LABELS: Readonly<Record<ReviewNoteKind, ReviewNoteDirectiveLabel>> = {
  blocking: 'BLOCKING',
  camera: 'CAMERA',
  'axis-break': 'BREAK-180',
  costume: 'COSTUME',
  extras: 'EXTRAS',
}

// Classification is deliberately a documented keyword table evaluated in this exact order, most specific first.
// A note that matches nothing is a blocking note, because a blocking mark is what a reviewer describes by default.
export const REVIEW_NOTE_CLASSIFIERS: ReadonlyArray<{ kind: ReviewNoteKind; pattern: RegExp }> = [
  { kind: 'axis-break', pattern: /\b(?:axis|180|line of action|crossed? the line|reverse angle|flipp?ed sides?|swapped sides?|side flip)\b/iu },
  { kind: 'costume', pattern: /\b(?:wardrobe|costume|outfit|uniform|jumpsuit|coverall|loincloth|hoodie|jacket|vest|hat|helmet|wearing|dressed|clothes)\b/iu },
  { kind: 'extras', pattern: /\b(?:extras?|crowd|crowds|background (?:people|characters|figures)|ensemble|bystanders|villagers|onlookers|deck crew)\b/iu },
  { kind: 'camera', pattern: /\b(?:camera|shot|angle|framing|frame|close[- ]?up|wide|medium|zoom|crop|cropped|lens|over[- ]the[- ]shoulder|ots|elevation|eye level|low angle|high angle)\b/iu },
  { kind: 'blocking', pattern: /(?:)/u },
]

const PANEL_HEADING = /^###\s+Panel\s+0*(\d+)\s*$/u

export const parseReviewNotesMarkdown = (content: string): ReviewNote[] => {
  const lines = content.replace(/\r\n/gu, '\n').split('\n')
  const notes: ReviewNote[] = []
  let current: { panelNumber: number; lineIndex: number; body: string[] } | undefined
  const flush = (): void => {
    if (!current) return
    const text = current.body.join('\n').replace(/\s+/gu, ' ').trim()
    if (text) notes.push({ panelNumber: current.panelNumber, lineIndex: current.lineIndex, text })
    current = undefined
  }
  for (const [lineIndex, line] of lines.entries()) {
    const heading = PANEL_HEADING.exec(line.trim())
    if (heading?.[1]) {
      flush()
      current = { panelNumber: Number(heading[1]), lineIndex, body: [] }
      continue
    }
    if (line.startsWith('### ') || /^#{1,2}\s/u.test(line)) {
      flush()
      continue
    }
    if (current) current.body.push(line)
  }
  flush()
  if (notes.length === 0) throw ValidationError('The review notes file has no "### Panel NN" sections with note text', { stage: STAGE })
  return notes
}

export const classifyReviewNote = (text: string): ReviewNoteClassification => {
  for (const classifier of REVIEW_NOTE_CLASSIFIERS) {
    const matches = Array.from(text.matchAll(new RegExp(classifier.pattern.source, `${classifier.pattern.flags.replace(/g/gu, '')}g`)))
      .map(match => match[0].toLowerCase())
    if (classifier.kind === 'blocking') return { kind: 'blocking', matches: [] }
    if (matches.length > 0) return { kind: classifier.kind, matches: Array.from(new Set(matches)) }
  }
  return { kind: 'blocking', matches: [] }
}

const findScriptLine = (scriptContent: string | undefined, segment: StructuredScriptSourceSegment | undefined): number | null => {
  if (!scriptContent || !segment) return null
  const needles = [segment.rawMarkdown, segment.text].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const lines = scriptContent.replace(/\r\n/gu, '\n').split('\n')
  for (const needle of needles) {
    const collapsed = needle.replace(/\s+/gu, ' ').trim()
    const index = lines.findIndex(line => line.replace(/\s+/gu, ' ').trim().includes(collapsed))
    if (index >= 0) return index + 1
  }
  return null
}

const resolveTarget = (
  panel: ScenePromptData['panels'][number],
  structuredScript: StructuredScriptData,
  scriptContent: string | undefined,
): ReviewNoteTarget => {
  const segmentId = panel.sourceSegmentIds[0] ?? null
  const segment = segmentId ? structuredScript.sourceSegments.find(item => item.id === segmentId) : undefined
  return {
    panelNumber: panel.number,
    locationKey: panel.locationKey,
    characterKeys: [...panel.characterKeys],
    segmentId,
    beatIndex: segment?.beatIndex ?? null,
    beatType: segment?.type ?? null,
    beatText: segment?.text ?? null,
    speakerLabel: segment?.speakerLabel ?? null,
    scriptLine: findScriptLine(scriptContent, segment),
  }
}

const formatHeader = (header: Record<string, string>): string =>
  `{${Object.entries(header).map(([key, value]) => `${key}: ${value}`).join(', ')}}`

// The costume header names the character the note itself mentions when the catalog recognizes one, because a
// costume note is about one character and the panel's first key is only a fallback.
const costumeCharacter = (note: ReviewNote, target: ReviewNoteTarget, catalog: Pick<CharacterCatalogService, 'detectMentions'> | undefined): string | undefined => {
  const mentioned = catalog?.detectMentions(note.text).flatMap(mention => mention.characterKeys) ?? []
  return mentioned.find(key => target.characterKeys.includes(key)) ?? mentioned[0] ?? target.characterKeys[0]
}

const buildDirective = (
  kind: ReviewNoteKind,
  note: ReviewNote,
  target: ReviewNoteTarget,
  catalog: Pick<CharacterCatalogService, 'detectMentions'> | undefined,
): { header: Record<string, string>; placeholders: string[]; directive: string } => {
  const placeholders: string[] = []
  const placeholder = (token: string): string => { placeholders.push(token); return token }
  const header: Record<string, string> = kind === 'blocking'
    ? { state: placeholder('<state-id>'), location: target.locationKey }
    : kind === 'camera' || kind === 'axis-break'
      ? { panel: String(target.panelNumber) }
      : kind === 'costume'
        ? { character: costumeCharacter(note, target, catalog) ?? placeholder('<character-key>') }
        : { group: placeholder('<ensemble-key>') }
  return { header, placeholders, directive: `**${REVIEW_NOTE_DIRECTIVE_LABELS[kind]}:** ${formatHeader(header)} ${note.text}` }
}

const emptyCounts = (): Record<ReviewNoteKind, number> => ({ blocking: 0, camera: 0, 'axis-break': 0, costume: 0, extras: 0 })

const escapeCell = (value: string): string => value.replace(/\|/gu, '\\|')

const formatReport = (result: Omit<ReviewNotesResult, 'outputPath'>, scriptDisplayPath: string, notesDisplayPath: string): string => {
  const rows = result.directives.map(item => `| ${item.target.panelNumber} | ${item.kind} | ${item.target.segmentId ?? 'unresolved'} | ${item.target.scriptLine ?? 'unresolved'} | ${item.placeholders.length > 0 ? escapeCell(item.placeholders.join(' ')) : 'none'} |`)
  const blocks = result.directives.map(item => [
    `### Panel ${item.target.panelNumber} (${item.kind})`,
    `- Target beat: ${item.target.segmentId ?? 'unresolved'}${item.target.beatIndex === null ? '' : ` (beat ${item.target.beatIndex}, ${item.target.beatType ?? 'unknown'}${item.target.speakerLabel ? `, ${item.target.speakerLabel}` : ''})`}`,
    `- Script file: ${scriptDisplayPath}${item.target.scriptLine === null ? ' (line unresolved)' : `, line ${item.target.scriptLine}`}`,
    `- Beat text: ${item.target.beatText ?? 'unresolved'}`,
    `- Reviewer note (notes line ${item.note.lineIndex + 1}): ${item.note.text}`,
    item.matches.length > 0 ? `- Classified as ${item.kind} by: ${item.matches.join(', ')}` : `- Classified as ${item.kind} by default; no keyword matched`,
    item.placeholders.length > 0 ? `- Fill in before pasting: ${item.placeholders.join(' ')}` : '- No placeholders to fill in',
    '',
    '```markdown',
    item.directive,
    '```',
  ].join('\n'))
  return [
    `# Review notes for ${result.sceneSlug}`,
    '',
    `Scene: ${result.sceneTitle}. Script: ${scriptDisplayPath}. Notes: ${notesDisplayPath}. Run: ${result.runId}. Panels in scene.json: ${result.panelCount}.`,
    '',
    'Paste each directive into the script immediately after the target beat. A directive never becomes a beat or a coverage segment; the structured-script parser stores it under `staging`.',
    '',
    '## Summary',
    '',
    '| Panel | Kind | Target beat | Script line | Placeholders |',
    '|---:|:---|:---|---:|:---|',
    ...rows,
    '',
    `Counts by kind: ${REVIEW_NOTE_KINDS.map(kind => `${kind}=${result.countsByKind[kind]}`).join(', ')}.`,
    '',
    ...(result.unmatched.length > 0
      ? ['## Unmatched notes', '', ...result.unmatched.map(item => `- Panel ${item.note.panelNumber} (notes line ${item.note.lineIndex + 1}): ${item.reason}`), '']
      : []),
    '## Paste-ready directives',
    '',
    ...(blocks.length > 0 ? blocks.flatMap(block => [block, '']) : ['No note mapped to a reviewed panel.', '']),
  ].join('\n')
}

export const reviewNotesCommand = async (
  options: ReviewNotesCommandOptions,
  dependencies: ReviewNotesCommandDependencies = {},
): Promise<ReviewNotesResult> => {
  try {
    const notesPath = options.notesPath
    if (!existsSync(notesPath)) throw InfraError(`Review notes file not found: ${notesPath}`, { stage: STAGE })
    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!existsSync(sceneJsonPath)) {
      throw InfraError(`Scene JSON not found at ${sceneJsonPath}. Run "bun autoshow comic draft-scenes <script-path>" first.`, { stage: STAGE })
    }
    const scene = v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(sceneJsonPath).text()))
    const structuredScript = await parseJsonFile(getStructuredScriptPath(options.sceneSlug), StructuredScriptDataSchema)
    const scriptContent = existsSync(options.scriptPath) ? await Bun.file(options.scriptPath).text() : undefined
    const notes = parseReviewNotesMarkdown(await Bun.file(notesPath).text())
    const catalog = dependencies.catalog ?? loadCharacterCatalogSafely()

    const panelsByNumber = new Map(scene.panels.map(panel => [panel.number, panel]))
    const directives: ReviewNoteDirective[] = []
    const unmatched: ReviewNoteUnmatched[] = []
    const countsByKind = emptyCounts()
    for (const note of notes) {
      const panel = panelsByNumber.get(note.panelNumber)
      if (!panel) {
        unmatched.push({ note, reason: `metadata/scene.json has no panel ${note.panelNumber}` })
        continue
      }
      const classification = classifyReviewNote(note.text)
      const target = resolveTarget(panel, structuredScript, scriptContent)
      const built = buildDirective(classification.kind, note, target, catalog)
      countsByKind[classification.kind] += 1
      directives.push({ note, kind: classification.kind, label: REVIEW_NOTE_DIRECTIVE_LABELS[classification.kind], matches: classification.matches, ...built, target })
    }

    const runId = dependencies.runId?.() ?? `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const outputPath = getReviewNotesPath(options.sceneSlug, runId)
    const scriptDisplayPath = relative(process.cwd(), options.scriptPath).startsWith('..') ? options.scriptPath : relative(process.cwd(), options.scriptPath)
    const notesDisplayPath = relative(process.cwd(), notesPath).startsWith('..') ? notesPath : relative(process.cwd(), notesPath)
    const partial = {
      runId,
      sceneSlug: options.sceneSlug,
      sceneTitle: scene.title,
      scriptPath: options.scriptPath,
      notesPath,
      panelCount: scene.panels.length,
      directives,
      unmatched,
      countsByKind,
    }
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, formatReport(partial, scriptDisplayPath, notesDisplayPath))

    for (const item of directives) comicLog.line(item.directive)
    comicLog.line('review-notes generated', [
      `file=${outputPath.slice(getReviewDirectory(options.sceneSlug).length + 1)}`,
      `notes=${notes.length}`,
      `directives=${directives.length}`,
      `unmatched=${unmatched.length}`,
      ...REVIEW_NOTE_KINDS.map(kind => `${kind}=${countsByKind[kind]}`),
    ])
    return { ...partial, outputPath }
  } catch (error) {
    err('Review note mapping failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
