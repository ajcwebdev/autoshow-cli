import { basename, resolve } from 'node:path'
import * as v from 'valibot'
import { StructuredScriptDataSchema } from '../../schemas/schemas'
import type { CharacterCatalogService, CharacterKey, ComicSourceIdentity, StructuredScriptBeat, StructuredScriptData } from '~/types'
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

    if (textIndex >= 0) spans.push(sourceSpan(source, beat.type === 'transition' ? 'scene-boundary' : 'spoken-text', textIndex, textIndex + beat.text.length))
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

export const parseScriptMarkdownToStructuredData = (
  content: string,
  scriptPath: string,
  options: { locationCatalog?: LocationReferenceCatalog; characterCatalog?: CharacterCatalogService; sourceIdentity?: ComicSourceIdentity } = {},
): StructuredScriptData => {
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
  const detectCharacterMentions = (text: string) => characterCatalog.detectMentions(text)
  const detectSpeakerLabelCharacters = (label: string): CharacterKey[] => {
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
  const resolveLocation = (raw: string) => {
    const slugline = extractLocationSlugline(raw) ?? raw
    const entry = resolveLocationCatalogEntry(slugline, locationCatalog)
    return parseLocation(raw, entry.key)
  }
  let activeLocation = resolveLocation(locationRaw)
  const body = lines
    .slice(hasSceneLocalLocation ? bodyStartIndex + 1 : bodyStartIndex)
    .join('\n')
    .trim()
  const blocks = expandScriptBlocks(splitIntoBlocks(body))
  const beats: StructuredScriptBeat[] = []
  const allCharacters: CharacterKey[] = []

  let activeSpeakerLabel: string | null = null
  let activeSpeakerCharacters: CharacterKey[] = []
  let pendingDelivery: string | null = null
  let pendingCaptionLabel: string | null = null
  let hasDialogueInCurrentTurn = false
  let continueDialogueAfterDirection = false
  let pendingSoundDirectivePrompt = false

  const resetSpeakerTurn = (): void => {
    activeSpeakerLabel = null
    activeSpeakerCharacters = []
    pendingDelivery = null
    hasDialogueInCurrentTurn = false
    continueDialogueAfterDirection = false
  }

  const nextBeatIndex = (): number => beats.length + 1
  const appendBeat = (options: Omit<StructuredScriptBeat, 'index' | 'location' | 'sourceSpans'>): void => {
    beats.push(buildBeat(nextBeatIndex(), { ...options, sourceSpans: [], location: activeLocation }))
  }

  const characterNameSet = new Set(characterCatalog.characterKeys)
  const registerCharacters = (characterKeys: CharacterKey[]): void => {
    for (const character of characterKeys) {
      if (!characterNameSet.has(character)) {
        continue
      }

      allCharacters.push(character)
    }
  }

  for (const blockInfo of blocks) {
    const block = blockInfo.text
    const soundDirective = parseSoundscapeBlockDirective(block)
    if (soundDirective) {
      pendingSoundDirectivePrompt = soundDirective.prompt === undefined
      resetSpeakerTurn()
      continue
    }
    if (pendingSoundDirectivePrompt) {
      pendingSoundDirectivePrompt = false
      resetSpeakerTurn()
      continue
    }
    const boldLine = extractSingleBoldLine(block)
    if (boldLine) {
      if (extractLocationSlugline(boldLine)) {
        activeLocation = resolveLocation(boldLine)
        appendBeat({ type: 'transition', text: boldLine, characterKeys: [], rawMentions: [] })
        resetSpeakerTurn()
        continue
      }
      const mentions = detectCharacterMentions(boldLine)
      const characters = getCharactersFromMentions(mentions)
      const speakerCharacters = detectSpeakerLabelCharacters(boldLine)

      if (isTransitionText(boldLine)) {
        appendBeat({
          type: 'transition',
          text: boldLine,
          characterKeys: characters,
          rawMentions: mentions,
        })
        registerCharacters(characters)
        resetSpeakerTurn()
        continue
      }

      if (speakerCharacters.length > 0) {
        activeSpeakerLabel = boldLine
        activeSpeakerCharacters = speakerCharacters
        pendingDelivery = null
        hasDialogueInCurrentTurn = false
        continueDialogueAfterDirection = false
        continue
      }

      if (isUncataloguedSpokenSpeakerLabel(boldLine)) {
        activeSpeakerLabel = boldLine
        activeSpeakerCharacters = []
        pendingDelivery = null
        hasDialogueInCurrentTurn = false
        continueDialogueAfterDirection = false
        continue
      }

      if (isCaptionSpeakerLabel(boldLine)) {
        resetSpeakerTurn()
        pendingCaptionLabel = boldLine.trim().toUpperCase()
        continue
      }

      appendBeat({
        type: 'direction',
        text: boldLine,
        characterKeys: characters,
        rawMentions: mentions,
      })
      registerCharacters(characters)
      resetSpeakerTurn()
      continue
    }

    if (isPanelNoteBlock(block)) {
      const text = trimPanelNote(block)
      const mentions = detectCharacterMentions(text)
      const characters = getCharactersFromMentions(mentions)
      appendBeat({
        type: 'panel-note',
        text,
        characterKeys: characters,
        rawMentions: mentions,
      })
      registerCharacters(characters)
      resetSpeakerTurn()
      continue
    }

    if (isParentheticalBlock(block)) {
      const text = trimParenthetical(block)
      const mentions = detectCharacterMentions(text)
      const characters = uniqueCharacters([
        ...activeSpeakerCharacters,
        ...getCharactersFromMentions(mentions),
      ])

      if (activeSpeakerLabel && !hasDialogueInCurrentTurn && !pendingDelivery) {
        pendingDelivery = text
        continue
      }

      appendBeat({
        type: 'direction',
        text,
        characterKeys: characters,
        rawMentions: mentions,
        ...(activeSpeakerCharacters.length === 1 ? { speakerKey: activeSpeakerCharacters[0] } : {}),
        ...(activeSpeakerCharacters.length > 1 ? { speakerKeys: activeSpeakerCharacters } : {}),
        ...(activeSpeakerLabel ? { speakerLabel: activeSpeakerLabel } : {}),
      })
      registerCharacters(characters)

      if (activeSpeakerLabel) {
        continueDialogueAfterDirection = true
      } else {
        resetSpeakerTurn()
      }

      continue
    }

    const text = stripEmphasisWrapper(normalizeBlockText(block))

    if (extractLocationSlugline(text)) {
      activeLocation = resolveLocation(text)
      appendBeat({ type: 'transition', text, characterKeys: [], rawMentions: [] })
      resetSpeakerTurn()
      continue
    }

    if (pendingCaptionLabel) {
      const captionLabel = pendingCaptionLabel
      const mentions = detectCharacterMentions(text)
      const characters = getCharactersFromMentions(mentions)

      appendBeat({
        type: 'narration',
        text,
        characterKeys: characters,
        rawMentions: mentions,
        speakerLabel: captionLabel,
      })
      registerCharacters(characters)
      pendingCaptionLabel = null
      resetSpeakerTurn()
      continue
    }

    if (
      activeSpeakerLabel
      && blockInfo.followsBoldLabelInSameBlock
      && !hasDialogueInCurrentTurn
      && !pendingDelivery
      && looksLikeLabeledActionFragment(text)
    ) {
      const mentions = detectCharacterMentions(text)
      const characters = uniqueCharacters([
        ...activeSpeakerCharacters,
        ...getCharactersFromMentions(mentions),
      ])

      appendBeat({
        type: 'direction',
        text,
        characterKeys: characters,
        rawMentions: mentions,
      })
      registerCharacters(characters)
      resetSpeakerTurn()
      continue
    }

    if (activeSpeakerLabel && (!hasDialogueInCurrentTurn || continueDialogueAfterDirection)) {
      const dialogue = extractLeadingDelivery(text)
      const spokenText = stripInlineSoundscapeDirectives(stripInlineStageDirections(dialogue.text))
      const mentions = detectCharacterMentions(spokenText)
      const mentionedCharacters = getCharactersFromMentions(mentions)
      const deliveryParts = [pendingDelivery, dialogue.delivery, ...extractInlineTimingDelivery(dialogue.text)]
        .flatMap(value => value?.split(',') ?? [])
        .map(value => value.trim())
        .filter(value => value && !isTimingOnlyDirection(value))
        .filter((value, index, all) => all.indexOf(value) === index)
      // Timing notation is pacing, not an acting note, and must not reach speech tone.
      const delivery = deliveryParts.length > 0 ? deliveryParts.join(', ') : undefined
      const characters = uniqueCharacters([
        ...activeSpeakerCharacters,
        ...mentionedCharacters,
      ])

      appendBeat({
        type: 'dialogue',
        text: spokenText,
        characterKeys: characters,
        rawMentions: mentions,
        ...(activeSpeakerCharacters.length === 1 ? { speakerKey: activeSpeakerCharacters[0] } : {}),
        ...(activeSpeakerLabel ? { speakerLabel: activeSpeakerLabel } : {}),
        ...(delivery ? { delivery } : {}),
      })
      registerCharacters(characters)
      hasDialogueInCurrentTurn = true
      pendingDelivery = null
      continueDialogueAfterDirection = false
      continue
    }

    const directionText = stripInlineSoundscapeDirectives(text)
    const mentions = detectCharacterMentions(directionText)
    const mentionedCharacters = getCharactersFromMentions(mentions)
    // Authored action blocks are staging for the artist, never lettered text. Only
    // an explicit caption label above the block produces a lettered narration beat.
    const type = isTransitionText(directionText) ? 'transition' : 'direction'
    appendBeat({
      type,
      text: directionText,
      characterKeys: mentionedCharacters,
      rawMentions: mentions,
    })
    registerCharacters(mentionedCharacters)
    resetSpeakerTurn()
  }

  const normalizedBeats = attachSourceSpans(content, beats.map((beat, index) => ({
    ...beat,
    index: index + 1,
  })))

  const sourceIdentity = options.sourceIdentity ?? fallbackSourceIdentity(content, scriptPath)
  const sourceSegments = buildSourceSegmentsFromBeats(normalizedBeats)
  const soundscape = buildStructuredSoundscape({ exactSource: content, expandedBlocks: blocks, sourceSegments, sourceIdentityHash: sourceIdentity.identityHash })

  return v.parse(StructuredScriptDataSchema, {
    schemaVersion: 5,
    scriptSlug: basename(scriptFile, '.md'),
    sourceFile: sourceIdentity.canonicalPath,
    sourceIdentity,
    document: {
      heading: documentHeading.heading,
      ...(documentHeading.label ? { label: documentHeading.label } : {}),
      title: documentHeading.title,
      metadata,
    },
    scene: {
      heading: sceneHeading.heading,
      ...(sceneHeading.label ? { section: sceneHeading.label } : {}),
      title: sceneHeading.title,
      location: resolveLocation(locationRaw),
      soundscape,
    },
    characterKeys: uniqueCharacters(allCharacters),
    beats: normalizedBeats,
    sourceSegments,
  })
}
