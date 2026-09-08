import type { TranscriptionEvidenceWord } from '~/types'
import { captionTextKey } from './caption-word-coverage'

type ConsensusTimingProvider = { provider: string; words: TranscriptionEvidenceWord[]; offsetSeconds: number }
type ConsensusTimingDecision = { wordIndex: number; supporting: { provider: string; wordIndex: number; startSeconds: number; endSeconds: number }[]; method: 'median' | 'provider' | 'interpolated'; review: boolean }

// Wording and canonical speakers must already be adjudicated. Anchor times and
// provider words are on the audio timeline; offsets map them to the video timeline.
// This aligns evidence only and never votes on, removes, or invents transcript text.
export const alignConsensusWords = (anchors: TranscriptionEvidenceWord[], providers: ConsensusTimingProvider[], anchorOffsetSeconds = 0): { words: TranscriptionEvidenceWord[]; decisions: ConsensusTimingDecision[] } => {
  const support = anchors.map(() => [] as ConsensusTimingDecision['supporting'])
  for (const provider of providers) {
    const width = provider.words.length + 1
    const directions = new Uint8Array((anchors.length + 1) * width)
    let previous = new Float64Array(width)
    for (let i = 1; i <= anchors.length; i++) {
      const current = new Float64Array(width)
      const anchor = anchors[i - 1]!
      for (let j = 1; j < width; j++) {
        const word = provider.words[j - 1]!
        const distance = Math.abs(anchor.startSeconds + anchorOffsetSeconds - word.startSeconds - provider.offsetSeconds)
        const matches = captionTextKey(anchor.text) !== '' && captionTextKey(anchor.text) === captionTextKey(word.text) && distance <= 2
          && Number.isFinite(word.startSeconds) && Number.isFinite(word.endSeconds) && word.endSeconds > word.startSeconds
          && (!anchor.speaker || !word.speaker || anchor.speaker === word.speaker)
        const diagonal = matches ? previous[j - 1]! + 3 - distance : -Infinity
        if (diagonal > previous[j]! && diagonal > current[j - 1]!) { current[j] = diagonal; directions[i * width + j] = 1 }
        else if (previous[j]! >= current[j - 1]!) { current[j] = previous[j]!; directions[i * width + j] = 2 }
        else { current[j] = current[j - 1]!; directions[i * width + j] = 3 }
      }
      previous = current
    }
    let i = anchors.length, j = provider.words.length
    while (i > 0 && j > 0) {
      const direction = directions[i * width + j]
      if (direction === 1) {
        const word = provider.words[j - 1]!
        support[i - 1]!.push({ provider: provider.provider, wordIndex: j - 1, startSeconds: word.startSeconds + provider.offsetSeconds, endSeconds: word.endSeconds + provider.offsetSeconds })
        i--; j--
      } else if (direction === 2) i--
      else j--
    }
  }
  const decisions: ConsensusTimingDecision[] = []
  const median = (values: number[]): number => { const sorted = values.toSorted((a, b) => a - b); return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2 }
  const words = anchors.map((anchor, wordIndex) => {
    const supporting = support[wordIndex]!
    const starts = supporting.map(word => word.startSeconds), ends = supporting.map(word => word.endSeconds)
    const agree = supporting.length >= 2 && Math.max(...starts) - Math.min(...starts) <= .1500001 && Math.max(...ends) - Math.min(...ends) <= .1500001
    const closest = supporting.toSorted((a, b) => Math.abs(a.startSeconds - anchor.startSeconds - anchorOffsetSeconds) - Math.abs(b.startSeconds - anchor.startSeconds - anchorOffsetSeconds))[0]
    const method = agree ? 'median' : closest ? 'provider' : 'interpolated'
    decisions.push({ wordIndex, supporting, method, review: !agree })
    return { ...anchor, startSeconds: agree ? median(starts) : closest?.startSeconds ?? anchor.startSeconds + anchorOffsetSeconds, endSeconds: agree ? median(ends) : closest?.endSeconds ?? anchor.endSeconds + anchorOffsetSeconds, timingSource: method === 'interpolated' ? 'interpolated' as const : 'repaired' as const }
  })
  words.forEach((word, index) => {
    if (!Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds <= word.startSeconds || (index > 0 && word.startSeconds < words[index - 1]!.endSeconds)) decisions[index]!.review = true
  })
  return { words, decisions }
}
