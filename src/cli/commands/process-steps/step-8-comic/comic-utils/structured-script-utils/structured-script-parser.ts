import { basename, resolve } from 'node:path'
import * as v from 'valibot'
import { StructuredScriptDataSchema } from '../../schemas/schemas'
import type { CharacterCatalogService, CharacterKey, ComicSourceIdentity, ExpandedScriptBlock, StructuredScriptBeat, StructuredScriptData } from '~/types'
import { loadCharacterCatalog, normalizeCharacterLookup } from '../character-reference-config'
import { getCharactersFromMentions, isUncataloguedSpokenSpeakerLabel, uniqueCharacters } from './character-detection'
import { buildSourceSegmentsFromBeats } from './source-segments'
import { buildBeat, expandScriptBlocks, extractInlineTimingDelivery, extractLeadingDelivery, extractLocationSlugline, extractSingleBoldLine, isCaptionSpeakerLabel, isPanelNoteBlock, isParentheticalBlock, isTimingOnlyDirection, isTransitionText, looksLikeLabeledActionFragment, normalizeBlockText, normalizeLineEndings, parseHeading, parseLocation, parseMetadataEntry, resolveFallbackSceneLocation, splitIntoBlocks, stripEmphasisWrapper, stripInlineStageDirections, trimPanelNote, trimParenthetical } from './markdown-blocks'
import { ValidationError } from '~/utils/error-handler'
import { readLocationReferenceCatalogSync, resolveLocationCatalogEntry, type LocationReferenceCatalog } from '../location-reference'
import { hashCanonicalTtsValue, sha256Bytes } from '../../../step-4-tts/script-to-audio/contract-identity'
import { toPosixPath, toProjectDisplayPath } from '~/utils/runtime-paths'
import { buildStructuredSoundscape, parseSoundscapeBlockDirective, stripInlineSoundscapeDirectives } from './soundscape-directives'

type StructuredSourceSpan = StructuredScriptBeat['sourceSpans'][number]

const scalarOffset = (value: string, utf16Offset: number): number => [...value.slice(0, utf16Offset)].length

const sourceSpan = (
  source: string,
  kind: StructuredSourceSpan['kind'],
  start: number,
  end: number
): StructuredSourceSpan => ({
  kind,
  start: scalarOffset(source, start),
  end: scalarOffset(source, end),
  indexUnit: 'unicode-scalar-value',
  text: source.slice(start, end),
})

const spokenSourceSpans = (
  source: string,
  canonicalText: string,
  start: number,
  end: number
): StructuredSourceSpan[] => {
  const words = [...canonicalText.matchAll(/\S+/gu)].map(match => match[0])
  if (words.length === 0) return []
  const ranges: Array<{ start: number, end: number }> = []
  let cursor = start
  for (const word of words) {
    const index = source.indexOf(word, cursor)
    if (index < cursor || index + word.length > end) return []
    const prior = ranges.at(-1)
    if (prior && /^\s*$/u.test(source.slice(prior.end, index))) prior.end = index + word.length
    else ranges.push({ start: index, end: index + word.length })
    cursor = index + word.length
  }
  return ranges.map(range => sourceSpan(source, 'spoken-text', range.start, range.end))
}

const attachSourceSpans = (source: string, beats: StructuredScriptBeat[]): StructuredScriptBeat[] => {
  let cursor = 0
  return beats.map((beat, beatIndex) => {
    const priorBeat = beats[beatIndex - 1]
    const speakerAnchor = beat.speakerLabel
      && beat.speakerLabel !== priorBeat?.speakerLabel
      && (beat.type === 'dialogue' || beat.type === 'narration')
      ? `**${beat.speakerLabel}**`
      : undefined
    const anchorIndex = speakerAnchor ? source.indexOf(speakerAnchor, cursor) : -1
    const textSearchStart = anchorIndex >= 0 && speakerAnchor ? anchorIndex + speakerAnchor.length : Math.max(cursor, anchorIndex)
    const textIndex = source.indexOf(beat.text, textSearchStart)
    const blockStart = anchorIndex >= 0 ? anchorIndex : textIndex >= 0 ? textIndex : cursor
    const boundarySearchStart = Math.max(blockStart + 1, textIndex >= 0 ? textIndex + beat.text.length : textSearchStart)
    const boundaryMatch = /\r?\n\r?\n/u.exec(source.slice(boundarySearchStart))
    const nextBoundary = boundaryMatch?.index === undefined ? -1 : boundarySearchStart + boundaryMatch.index
    const blockEnd = nextBoundary >= 0 ? nextBoundary : source.length
    const nextSpeakerBoundaryMatch = /\r?\n\r?\n\*\*[^*\r\n]+\*\*/u.exec(source.slice(textSearchStart))
    const nextSpeakerBoundary = nextSpeakerBoundaryMatch?.index === undefined ? source.length : textSearchStart + nextSpeakerBoundaryMatch.index
    const spanSearchEnd = textIndex < 0 && (beat.type === 'dialogue' || beat.type === 'narration') ? nextSpeakerBoundary : blockEnd
    const block = source.slice(blockStart, spanSearchEnd)
    const spans: StructuredSourceSpan[] = []

    // A zero-length span is never a valid half-open range, and indexOf('') returns the
    // search cursor rather than -1, so an empty beat text would otherwise emit start === end.
    if (textIndex >= 0 && beat.text.length > 0) spans.push(sourceSpan(source, beat.type === 'transition' ? 'scene-boundary' : 'spoken-text', textIndex, textIndex + beat.text.length))
    else if (beat.type === 'dialogue' || beat.type === 'narration') spans.push(...spokenSourceSpans(source, beat.text, textSearchStart, spanSearchEnd))
    if (beat.delivery) {
      const deliveryIndex = block.indexOf(beat.delivery)
      if (deliveryIndex >= 0) spans.push(sourceSpan(source, 'delivery', blockStart + deliveryIndex, blockStart + deliveryIndex + beat.delivery.length))
    }
    for (const match of block.matchAll(/\(\s*(?:(?:(?:a|an|another|one|two|long|short|brief|slight|small|awkward|uncomfortable|heavy|dead|stunned|very)\s+)*(?:beat|beats|pause|pauses|silence|moment|moments))(?:\s*,\s*[^)]*)?\s*\)/giu)) {
      if (match.index === undefined) continue
      spans.push(sourceSpan(source, 'timing', blockStart + match.index, blockStart + match.index + match[0].length))
    }
    if (beat.speakerLabel) {
      for (const match of beat.speakerLabel.matchAll(/(?:\bV\.O\.|\bO\.S\.|\bOFFSCREEN\b|\bRADIO\b|\bINTERCOM\b|\bTELEPHONE\b|\bCOMPUTER\b)/giu)) {
        if (match.index === undefined || anchorIndex < 0) continue
        const labelOffset = speakerAnchor?.indexOf(beat.speakerLabel) ?? 0
        const start = anchorIndex + labelOffset + match.index
        spans.push(sourceSpan(source, 'voice-effect', start, start + match[0].length))
      }
    }
    if ((beat.speakerKeys?.length ?? 0) > 1 && anchorIndex >= 0 && speakerAnchor) {
      spans.push(sourceSpan(source, 'simultaneous-speech', anchorIndex, anchorIndex + speakerAnchor.length))
    }
    if (spans.length === 0 && blockStart < spanSearchEnd) spans.push(sourceSpan(source, 'stage-direction', blockStart, spanSearchEnd))
    cursor = Math.max(cursor, blockEnd)
    return { ...beat, sourceSpans: spans.sort((left, right) => left.start - right.start || left.end - right.end || left.kind.localeCompare(right.kind)) }
  })
}

const fallbackSourceIdentity = (content: string, scriptPath: string): ComicSourceIdentity => {
  const canonicalPath = toPosixPath(toProjectDisplayPath(resolve(scriptPath)))
  const base = { schemaVersion: 1 as const, canonicalPath, scriptSlug: basename(scriptPath, '.md'), contentSha256: sha256Bytes(content) }
  return { ...base, identityHash: hashCanonicalTtsValue(base) }
}

interface StructuredScriptParserOptions {
  locationCatalog?: LocationReferenceCatalog
  characterCatalog?: CharacterCatalogService
  sourceIdentity?: ComicSourceIdentity
}

interface StructuredScriptEnvelope {
  content: string
  scriptPath: string
  scriptFile: string
  documentHeading: ReturnType<typeof parseHeading>
  sceneHeading: ReturnType<typeof parseHeading>
  metadata: StructuredScriptData['document']['metadata']
  locationRaw: string
  locationCatalog: LocationReferenceCatalog
  characterCatalog: CharacterCatalogService
  blocks: ExpandedScriptBlock[]
  providedSourceIdentity: ComicSourceIdentity | undefined
}

interface StructuredScriptParserState {
  envelope: StructuredScriptEnvelope
  activeLocation: StructuredScriptData['scene']['location']
  beats: StructuredScriptBeat[]
  allCharacters: CharacterKey[]
  characterNameSet: Set<CharacterKey>
  activeSpeakerLabel: string | null
  activeSpeakerCharacters: CharacterKey[]
  pendingDelivery: string | null
  pendingCaptionLabel: string | null
  hasDialogueInCurrentTurn: boolean
  continueDialogueAfterDirection: boolean
  pendingSoundDirectivePrompt: boolean
}

type StructuredScriptMention = StructuredScriptBeat['rawMentions'][number]
type StructuredScriptBeatInput = Omit<StructuredScriptBeat, 'index' | 'location' | 'sourceSpans'>
type SoundDirectiveClassification = {
  kind: 'sound-directive'
  waitsForPrompt: boolean
} | {
  kind: 'sound-directive-prompt'
}
type BoldLabelClassification = {
  kind: 'bold-label'
  label: string
  role: 'location'
} | {
  kind: 'bold-label'
  label: string
  role: 'transition' | 'direction'
  mentions: StructuredScriptMention[]
  characters: CharacterKey[]
} | {
  kind: 'bold-label'
  label: string
  role: 'speaker'
  characters: CharacterKey[]
} | {
  kind: 'bold-label'
  label: string
  role: 'uncatalogued-speaker' | 'caption'
}
type TextBlockClassification = {
  kind: 'location-transition' | 'caption' | 'labelled-action-fragment' | 'dialogue' | 'direction'
  text: string
}
type ClassifiedStructuredScriptBlock =
  | SoundDirectiveClassification
  | BoldLabelClassification
  | { kind: 'panel-note'; block: string }
  | { kind: 'parenthetical'; block: string }
  | TextBlockClassification

const parseStructuredScriptEnvelope = (
  content: string,
  scriptPath: string,
  options: StructuredScriptParserOptions = {},
): StructuredScriptEnvelope => {
  const scriptFile = basename(scriptPath)
  const normalized = normalizeLineEndings(content).trim()
  const lines = normalized.split('\n')
  const titleIndex = lines.findIndex(line => line.trim().startsWith('# '))

  if (titleIndex < 0) {
    throw ValidationError(`Script "${scriptFile}" is missing a top-level "# " heading`, { stage: 'comic:script-parse' })
  }

  const sceneHeadingIndex = lines.findIndex((line, index) => index > titleIndex && line.trim().startsWith('## '))
  if (sceneHeadingIndex < 0) {
    throw ValidationError(`Script "${scriptFile}" is missing a scene heading`, { stage: 'comic:script-parse' })
  }

  const documentHeading = parseHeading(lines[titleIndex]!.trim().replace(/^#\s+/, ''))
  const sceneHeading = parseHeading(
    lines[sceneHeadingIndex]!.trim().replace(/^##\s+/, ''),
    { stripWrappingQuotes: true }
  )

  const metadata = lines
    .slice(titleIndex + 1, sceneHeadingIndex)
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== '---')
    .map(extractSingleBoldLine)
    .filter((line): line is string => line !== null)
    .map(parseMetadataEntry)

  const firstBodyLineIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim()
    return index > sceneHeadingIndex && trimmed.length > 0 && trimmed !== '---'
  })
  const bodyStartIndex = firstBodyLineIndex < 0 ? lines.length : firstBodyLineIndex
  const firstBodyLine = firstBodyLineIndex < 0 ? '' : lines[firstBodyLineIndex]?.trim() ?? ''
  const firstBodyBoldLine = extractSingleBoldLine(firstBodyLine)
  const hasSceneLocalLocation = firstBodyBoldLine !== null && extractLocationSlugline(firstBodyBoldLine) !== null
  const locationRaw = hasSceneLocalLocation && firstBodyBoldLine
    ? firstBodyBoldLine
    : resolveFallbackSceneLocation(metadata, sceneHeading.title)
  const locationCatalog = options.locationCatalog ?? readLocationReferenceCatalogSync()
  const characterCatalog = options.characterCatalog ?? loadCharacterCatalog()
  const body = lines
    .slice(hasSceneLocalLocation ? bodyStartIndex + 1 : bodyStartIndex)
    .join('\n')
    .trim()
  const blocks = expandScriptBlocks(splitIntoBlocks(body))
  return {
    content,
    scriptPath,
    scriptFile,
    documentHeading,
    sceneHeading,
    metadata,
    locationRaw,
    locationCatalog,
    characterCatalog,
    blocks,
    providedSourceIdentity: options.sourceIdentity,
  }
}

const resolveStructuredLocation = (
  raw: string,
  envelope: StructuredScriptEnvelope,
): StructuredScriptData['scene']['location'] => {
  const slugline = extractLocationSlugline(raw) ?? raw
  const entry = resolveLocationCatalogEntry(slugline, envelope.locationCatalog)
  return parseLocation(raw, entry.key)
}

const detectStructuredSpeakerCharacters = (
  label: string,
  characterCatalog: CharacterCatalogService,
): CharacterKey[] => {
  const direct = characterCatalog.resolve(label)
  if (direct) return [...direct]
  const parts = normalizeCharacterLookup(label).split(/\s*(?:,|&|\bAND\b)\s*/i).filter(Boolean)
  if (parts.length < 2) return []
  const keys: CharacterKey[] = []
  for (const part of parts) {
    const resolved = characterCatalog.resolve(part)
    if (!resolved) return []
    keys.push(...resolved)
  }
  return uniqueCharacters(keys)
}

const createStructuredScriptParserState = (
  envelope: StructuredScriptEnvelope,
): StructuredScriptParserState => ({
  envelope,
  activeLocation: resolveStructuredLocation(envelope.locationRaw, envelope),
  beats: [],
  allCharacters: [],
  characterNameSet: new Set(envelope.characterCatalog.characterKeys),
  activeSpeakerLabel: null,
  activeSpeakerCharacters: [],
  pendingDelivery: null,
  pendingCaptionLabel: null,
  hasDialogueInCurrentTurn: false,
  continueDialogueAfterDirection: false,
  pendingSoundDirectivePrompt: false,
})

const resetSpeakerTurn = (state: StructuredScriptParserState): void => {
  state.activeSpeakerLabel = null
  state.activeSpeakerCharacters = []
  state.pendingDelivery = null
  state.hasDialogueInCurrentTurn = false
  state.continueDialogueAfterDirection = false
}

const appendStructuredBeat = (
  state: StructuredScriptParserState,
  options: StructuredScriptBeatInput,
): void => {
  state.beats.push(buildBeat(state.beats.length + 1, {
    ...options,
    sourceSpans: [],
    location: state.activeLocation,
  }))
}

const registerStructuredCharacters = (
  state: StructuredScriptParserState,
  characterKeys: CharacterKey[],
): void => {
  for (const character of characterKeys) {
    if (state.characterNameSet.has(character)) state.allCharacters.push(character)
  }
}

const classifyBoldLabel = (
  state: StructuredScriptParserState,
  label: string,
): BoldLabelClassification => {
  if (extractLocationSlugline(label)) return { kind: 'bold-label', label, role: 'location' }
  const mentions = state.envelope.characterCatalog.detectMentions(label)
  const characters = getCharactersFromMentions(mentions)
  const speakerCharacters = detectStructuredSpeakerCharacters(label, state.envelope.characterCatalog)
  if (isTransitionText(label)) return { kind: 'bold-label', label, role: 'transition', mentions, characters }
  if (speakerCharacters.length > 0) return { kind: 'bold-label', label, role: 'speaker', characters: speakerCharacters }
  if (isUncataloguedSpokenSpeakerLabel(label)) return { kind: 'bold-label', label, role: 'uncatalogued-speaker' }
  if (isCaptionSpeakerLabel(label)) return { kind: 'bold-label', label, role: 'caption' }
  return { kind: 'bold-label', label, role: 'direction', mentions, characters }
}

const classifyStructuredScriptBlock = (
  state: StructuredScriptParserState,
  blockInfo: ExpandedScriptBlock,
): ClassifiedStructuredScriptBlock => {
  const block = blockInfo.text
  const soundDirective = parseSoundscapeBlockDirective(block)
  if (soundDirective) return { kind: 'sound-directive', waitsForPrompt: soundDirective.prompt === undefined }
  if (state.pendingSoundDirectivePrompt) return { kind: 'sound-directive-prompt' }
  const boldLine = extractSingleBoldLine(block)
  if (boldLine) return classifyBoldLabel(state, boldLine)
  if (isPanelNoteBlock(block)) return { kind: 'panel-note', block }
  if (isParentheticalBlock(block)) return { kind: 'parenthetical', block }
  const text = stripEmphasisWrapper(normalizeBlockText(block))
  if (extractLocationSlugline(text)) return { kind: 'location-transition', text }
  if (state.pendingCaptionLabel) return { kind: 'caption', text }
  if (
    state.activeSpeakerLabel
    && blockInfo.followsBoldLabelInSameBlock
    && !state.hasDialogueInCurrentTurn
    && !state.pendingDelivery
    && looksLikeLabeledActionFragment(text)
  ) {
    return { kind: 'labelled-action-fragment', text }
  }
  if (state.activeSpeakerLabel && (!state.hasDialogueInCurrentTurn || state.continueDialogueAfterDirection)) {
    return { kind: 'dialogue', text }
  }
  return { kind: 'direction', text }
}

const handleSoundDirective = (
  state: StructuredScriptParserState,
  classification: SoundDirectiveClassification,
): void => {
  state.pendingSoundDirectivePrompt = classification.kind === 'sound-directive'
    ? classification.waitsForPrompt
    : false
  resetSpeakerTurn(state)
}

const handleLocationTransition = (
  state: StructuredScriptParserState,
  text: string,
): void => {
  state.activeLocation = resolveStructuredLocation(text, state.envelope)
  appendStructuredBeat(state, { type: 'transition', text, characterKeys: [], rawMentions: [] })
  resetSpeakerTurn(state)
}

const handleBoldLabel = (
  state: StructuredScriptParserState,
  classification: BoldLabelClassification,
): void => {
  if (classification.role === 'location') {
    handleLocationTransition(state, classification.label)
    return
  }
  if (classification.role === 'transition' || classification.role === 'direction') {
    appendStructuredBeat(state, {
      type: classification.role,
      text: classification.label,
      characterKeys: classification.characters,
      rawMentions: classification.mentions,
    })
    registerStructuredCharacters(state, classification.characters)
    resetSpeakerTurn(state)
    return
  }
  if (classification.role === 'caption') {
    resetSpeakerTurn(state)
    state.pendingCaptionLabel = classification.label.trim().toUpperCase()
    return
  }
  state.activeSpeakerLabel = classification.label
  state.activeSpeakerCharacters = classification.role === 'speaker' ? classification.characters : []
  state.pendingDelivery = null
  state.hasDialogueInCurrentTurn = false
  state.continueDialogueAfterDirection = false
}

const handlePanelNote = (
  state: StructuredScriptParserState,
  block: string,
): void => {
  const text = trimPanelNote(block)
  const mentions = state.envelope.characterCatalog.detectMentions(text)
  const characters = getCharactersFromMentions(mentions)
  appendStructuredBeat(state, { type: 'panel-note', text, characterKeys: characters, rawMentions: mentions })
  registerStructuredCharacters(state, characters)
  resetSpeakerTurn(state)
}

const handleParenthetical = (
  state: StructuredScriptParserState,
  block: string,
): void => {
  const text = trimParenthetical(block)
  const mentions = state.envelope.characterCatalog.detectMentions(text)
  const characters = uniqueCharacters([
    ...state.activeSpeakerCharacters,
    ...getCharactersFromMentions(mentions),
  ])
  if (state.activeSpeakerLabel && !state.hasDialogueInCurrentTurn && !state.pendingDelivery) {
    state.pendingDelivery = text
    return
  }
  appendStructuredBeat(state, {
    type: 'direction',
    text,
    characterKeys: characters,
    rawMentions: mentions,
    ...(state.activeSpeakerCharacters.length === 1 ? { speakerKey: state.activeSpeakerCharacters[0] } : {}),
    ...(state.activeSpeakerCharacters.length > 1 ? { speakerKeys: state.activeSpeakerCharacters } : {}),
    ...(state.activeSpeakerLabel ? { speakerLabel: state.activeSpeakerLabel } : {}),
  })
  registerStructuredCharacters(state, characters)
  if (state.activeSpeakerLabel) state.continueDialogueAfterDirection = true
  else resetSpeakerTurn(state)
}

const handleCaption = (
  state: StructuredScriptParserState,
  text: string,
): void => {
  const captionLabel = state.pendingCaptionLabel!
  const mentions = state.envelope.characterCatalog.detectMentions(text)
  const characters = getCharactersFromMentions(mentions)
  appendStructuredBeat(state, {
    type: 'narration',
    text,
    characterKeys: characters,
    rawMentions: mentions,
    speakerLabel: captionLabel,
  })
  registerStructuredCharacters(state, characters)
  state.pendingCaptionLabel = null
  resetSpeakerTurn(state)
}

const handleLabelledActionFragment = (
  state: StructuredScriptParserState,
  text: string,
): void => {
  const mentions = state.envelope.characterCatalog.detectMentions(text)
  const characters = uniqueCharacters([
    ...state.activeSpeakerCharacters,
    ...getCharactersFromMentions(mentions),
  ])
  appendStructuredBeat(state, { type: 'direction', text, characterKeys: characters, rawMentions: mentions })
  registerStructuredCharacters(state, characters)
  resetSpeakerTurn(state)
}

const dialogueDelivery = (
  state: StructuredScriptParserState,
  dialogue: ReturnType<typeof extractLeadingDelivery>,
): string | undefined => {
  const parts = [state.pendingDelivery, dialogue.delivery, ...extractInlineTimingDelivery(dialogue.text)]
    .flatMap(value => value?.split(',') ?? [])
    .map(value => value.trim())
    .filter(value => value && !isTimingOnlyDirection(value))
    .filter((value, index, all) => all.indexOf(value) === index)
  return parts.length > 0 ? parts.join(', ') : undefined
}

const handleDialogue = (
  state: StructuredScriptParserState,
  text: string,
): void => {
  const dialogue = extractLeadingDelivery(text)
  const spokenText = stripInlineSoundscapeDirectives(stripInlineStageDirections(dialogue.text))
  const mentions = state.envelope.characterCatalog.detectMentions(spokenText)
  const characters = uniqueCharacters([
    ...state.activeSpeakerCharacters,
    ...getCharactersFromMentions(mentions),
  ])
  const delivery = dialogueDelivery(state, dialogue)
  appendStructuredBeat(state, {
    type: 'dialogue',
    text: spokenText,
    characterKeys: characters,
    rawMentions: mentions,
    ...(state.activeSpeakerCharacters.length === 1 ? { speakerKey: state.activeSpeakerCharacters[0] } : {}),
    ...(state.activeSpeakerLabel ? { speakerLabel: state.activeSpeakerLabel } : {}),
    ...(delivery ? { delivery } : {}),
  })
  registerStructuredCharacters(state, characters)
  state.hasDialogueInCurrentTurn = true
  state.pendingDelivery = null
  state.continueDialogueAfterDirection = false
}

const handleDirection = (
  state: StructuredScriptParserState,
  text: string,
): void => {
  const directionText = stripInlineSoundscapeDirectives(text)
  const mentions = state.envelope.characterCatalog.detectMentions(directionText)
  const characters = getCharactersFromMentions(mentions)
  appendStructuredBeat(state, {
    type: isTransitionText(directionText) ? 'transition' : 'direction',
    text: directionText,
    characterKeys: characters,
    rawMentions: mentions,
  })
  registerStructuredCharacters(state, characters)
  resetSpeakerTurn(state)
}

const dispatchStructuredScriptBlock = (
  state: StructuredScriptParserState,
  classification: ClassifiedStructuredScriptBlock,
): void => {
  switch (classification.kind) {
    case 'sound-directive':
    case 'sound-directive-prompt':
      return handleSoundDirective(state, classification)
    case 'bold-label':
      return handleBoldLabel(state, classification)
    case 'panel-note':
      return handlePanelNote(state, classification.block)
    case 'parenthetical':
      return handleParenthetical(state, classification.block)
    case 'location-transition':
      return handleLocationTransition(state, classification.text)
    case 'caption':
      return handleCaption(state, classification.text)
    case 'labelled-action-fragment':
      return handleLabelledActionFragment(state, classification.text)
    case 'dialogue':
      return handleDialogue(state, classification.text)
    case 'direction':
      return handleDirection(state, classification.text)
  }
}

const finalizeStructuredScript = (
  state: StructuredScriptParserState,
): StructuredScriptData => {
  const { envelope } = state
  const normalizedBeats = attachSourceSpans(envelope.content, state.beats.map((beat, index) => ({
    ...beat,
    index: index + 1,
  })))
  const sourceIdentity = envelope.providedSourceIdentity ?? fallbackSourceIdentity(envelope.content, envelope.scriptPath)
  const sourceSegments = buildSourceSegmentsFromBeats(normalizedBeats)
  const soundscape = buildStructuredSoundscape({
    exactSource: envelope.content,
    expandedBlocks: envelope.blocks,
    sourceSegments,
    sourceIdentityHash: sourceIdentity.identityHash,
  })

  return v.parse(StructuredScriptDataSchema, {
    schemaVersion: 5,
    scriptSlug: basename(envelope.scriptFile, '.md'),
    sourceFile: sourceIdentity.canonicalPath,
    sourceIdentity,
    document: {
      heading: envelope.documentHeading.heading,
      ...(envelope.documentHeading.label ? { label: envelope.documentHeading.label } : {}),
      title: envelope.documentHeading.title,
      metadata: envelope.metadata,
    },
    scene: {
      heading: envelope.sceneHeading.heading,
      ...(envelope.sceneHeading.label ? { section: envelope.sceneHeading.label } : {}),
      title: envelope.sceneHeading.title,
      location: resolveStructuredLocation(envelope.locationRaw, envelope),
      soundscape,
    },
    characterKeys: uniqueCharacters(state.allCharacters),
    beats: normalizedBeats,
    sourceSegments,
  })
}

export const parseScriptMarkdownToStructuredData = (
  content: string,
  scriptPath: string,
  options: StructuredScriptParserOptions = {},
): StructuredScriptData => {
  const state = createStructuredScriptParserState(parseStructuredScriptEnvelope(content, scriptPath, options))
  for (const blockInfo of state.envelope.blocks) {
    dispatchStructuredScriptBlock(state, classifyStructuredScriptBlock(state, blockInfo))
  }
  return finalizeStructuredScript(state)
}
