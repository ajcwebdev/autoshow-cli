import { basename } from 'node:path'
import * as v from 'valibot'
import { StructuredScriptDataSchema } from '../../schemas/schemas'
import type { CharacterCatalogService, CharacterKey, StructuredScriptBeat, StructuredScriptData } from '~/types'
import { loadCharacterCatalog, normalizeCharacterLookup } from '../character-reference-config'
import { getCharactersFromMentions, isUncataloguedSpokenSpeakerLabel, uniqueCharacters } from './character-detection'
import { buildSourceSegmentsFromBeats } from './source-segments'
import { buildBeat, expandScriptBlocks, extractLeadingDelivery, extractLocationSlugline, extractSingleBoldLine, isCaptionSpeakerLabel, isPanelNoteBlock, isParentheticalBlock, isTimingOnlyDirection, isTransitionText, looksLikeLabeledActionFragment, normalizeBlockText, normalizeLineEndings, parseHeading, parseLocation, parseMetadataEntry, resolveFallbackSceneLocation, splitIntoBlocks, stripEmphasisWrapper, stripInlineStageDirections, trimPanelNote, trimParenthetical } from './markdown-blocks'
import { ValidationError } from '~/utils/error-handler'
import { readLocationReferenceCatalogSync, resolveLocationCatalogEntry, type LocationReferenceCatalog } from '../location-reference'

export const parseScriptMarkdownToStructuredData = (
  content: string,
  scriptPath: string,
  options: { locationCatalog?: LocationReferenceCatalog; characterCatalog?: CharacterCatalogService } = {},
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

  const resetSpeakerTurn = (): void => {
    activeSpeakerLabel = null
    activeSpeakerCharacters = []
    pendingDelivery = null
    hasDialogueInCurrentTurn = false
    continueDialogueAfterDirection = false
  }

  const nextBeatIndex = (): number => beats.length + 1
  const appendBeat = (options: Omit<StructuredScriptBeat, 'index' | 'location'>): void => {
    beats.push(buildBeat(nextBeatIndex(), { ...options, location: activeLocation }))
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
      const spokenText = stripInlineStageDirections(dialogue.text)
      const mentions = detectCharacterMentions(spokenText)
      const mentionedCharacters = getCharactersFromMentions(mentions)
      const rawDelivery = pendingDelivery ?? dialogue.delivery
      // Timing notation is pacing, not an acting note, and must not reach speech tone.
      const delivery = rawDelivery && !isTimingOnlyDirection(rawDelivery) ? rawDelivery : undefined
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

    const mentions = detectCharacterMentions(text)
    const mentionedCharacters = getCharactersFromMentions(mentions)
    // Authored action blocks are staging for the artist, never lettered text. Only
    // an explicit caption label above the block produces a lettered narration beat.
    const type = isTransitionText(text) ? 'transition' : 'direction'
    appendBeat({
      type,
      text,
      characterKeys: mentionedCharacters,
      rawMentions: mentions,
    })
    registerCharacters(mentionedCharacters)
    resetSpeakerTurn()
  }

  const normalizedBeats = beats.map((beat, index) => ({
    ...beat,
    index: index + 1,
  }))

  return v.parse(StructuredScriptDataSchema, {
    schemaVersion: 3,
    scriptSlug: basename(scriptFile, '.md'),
    sourceFile: scriptPath,
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
    },
    characterKeys: uniqueCharacters(allCharacters),
    beats: normalizedBeats,
    sourceSegments: buildSourceSegmentsFromBeats(normalizedBeats),
  })
}
