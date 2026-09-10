import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'

export const captionTextKey = (text: string): string => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export const captionTimestampSeconds = (stamp: string): number => {
  const parts = stamp.replace(',', '.').split(':').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part) || part < 0) || parts[1]! >= 60 || parts[2]! >= 60) return Number.NaN
  return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
}

// Keep the source evidence immutable. Inferred words belong only to the export
// timeline, so reflowing captions never rewrites provider timing measurements.
export const resolveCaptionWordCoverage = (result: TranscriptionResult): {
  words: TranscriptionEvidenceWord[]
  inferredWords: number
  invalidWords: number
  uncoveredText: boolean
} => {
  let invalidWords = 0
  const seen = new Set<string>()
  const native = (result.evidence?.words ?? []).filter(word => {
    if (!word.text.trim() || !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds <= word.startSeconds) {
      invalidWords++
      return false
    }
    const key = JSON.stringify([word.startSeconds, word.endSeconds, word.text, word.speaker])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)

  // Complete native evidence remains authoritative, including overlapping speakers
  // and multiword tokens produced by provider formatting.
  if (native.length > 0 && captionTextKey(native.map(word => word.text).join(' ')) === captionTextKey(result.text)) {
    return { words: native, inferredWords: 0, invalidWords, uncoveredText: false }
  }
  const segments = (result.evidence?.segments?.length ? result.evidence.segments.map(segment => ({
    start: segment.startSeconds, end: segment.endSeconds, text: segment.text, speaker: segment.speaker
  })) : result.segments.map(segment => ({
    start: captionTimestampSeconds(segment.start), end: captionTimestampSeconds(segment.end), text: segment.text, speaker: segment.speaker
  })))
  const words: TranscriptionEvidenceWord[] = []
  const used = new Set<TranscriptionEvidenceWord>()
  let inferredWords = 0
  let uncoveredText = false
  const lowerBound = (time: number): number => {
    let low = 0, high = native.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (native[mid]!.startSeconds < time) low = mid + 1
      else high = mid
    }
    return low
  }
  for (const segment of segments) {
    const tokens = segment.text.match(/\S+/gu) ?? []
    if (tokens.length === 0) continue
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end <= segment.start) {
      // A word-only response may have a placeholder segment; retain its actual
      // evidence, but don't fabricate timing for text absent from that evidence.
      continue
    }
    const candidates = native.slice(lowerBound(segment.start - 0.002), lowerBound(segment.end)).filter(word => !used.has(word) && (!segment.speaker || !word.speaker || word.speaker === segment.speaker))
    const aligned: Array<TranscriptionEvidenceWord | undefined> = tokens.map(() => undefined)
    const tokenPositions = new Map<string, number[]>()
    tokens.forEach((token, index) => {
      const key = captionTextKey(token)
      const positions = tokenPositions.get(key) ?? []
      positions.push(index)
      tokenPositions.set(key, positions)
    })
    let cursor = 0
    for (const word of candidates) {
      const key = captionTextKey(word.text)
      if (!key) continue
      const positions = tokenPositions.get(key) ?? []
      let low = 0, high = positions.length
      while (low < high) {
        const mid = (low + high) >>> 1
        if (positions[mid]! < cursor) low = mid + 1
        else high = mid
      }
      const index = positions[low]
      if (index === undefined) continue
      aligned[index] = { ...word, text: tokens[index]!, ...(word.speaker ?? segment.speaker ? { speaker: word.speaker ?? segment.speaker } : {}) }
      cursor = index + 1
      used.add(word)
    }
    for (let i = 0; i < tokens.length;) {
      const known = aligned[i]
      if (known) {
        words.push(known)
        i++
        continue
      }
      const startIndex = i
      while (i < tokens.length && !aligned[i]) i++
      const before = aligned[startIndex - 1]
      const after = aligned[i]
      const start = Math.max(segment.start, before?.endSeconds ?? segment.start)
      const end = Math.max(start, Math.min(segment.end, after?.startSeconds ?? segment.end))
      const count = i - startIndex
      for (let j = startIndex; j < i; j++) {
        const text = tokens[j]!
        words.push({
          startSeconds: start + (end - start) * (j - startIndex) / count,
          endSeconds: start + (end - start) * (j - startIndex + 1) / count,
          text, normalized: text.toLowerCase(), ...(segment.speaker ? { speaker: segment.speaker } : {}),
          timingSource: result.evidence?.timingQuality === 'generated' ? 'generated' : 'interpolated'
        })
        inferredWords++
      }
    }
    // The segment text is authoritative for this span. Extra provider tokens
    // (punctuation, duplicate formatting, substitutions) must not repeat it.
    for (const word of candidates) used.add(word)
  }
  words.push(...native.filter(word => !used.has(word)))
  words.sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)
  // Compare as a multiset so overlapping speakers don't fail due to ordering.
  const remaining = new Map<string, number>()
  for (const token of result.text.match(/\S+/gu) ?? []) {
    const key = captionTextKey(token)
    if (key) remaining.set(key, (remaining.get(key) ?? 0) + 1)
  }
  for (const word of words) for (const token of word.text.match(/\S+/gu) ?? []) {
    const key = captionTextKey(token)
    remaining.set(key, Math.max(0, (remaining.get(key) ?? 0) - 1))
  }
  uncoveredText = [...remaining.values()].some(count => count > 0)
  return { words, inferredWords, invalidWords, uncoveredText }
}
