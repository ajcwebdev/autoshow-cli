import { ValidationError } from '~/utils/error-handler'

export type CtcWordInput = { text: string; tokens: number[] }

// CTC Viterbi: blank-separated target states, with a mandatory blank between
// repeated labels. Word endpoints come from occupied acoustic frames.
export const alignCtcWords = (frames: number[][], words: CtcWordInput[], blank: number, frameSeconds: number, separator?: number) => {
  if (!frames.length || !words.length || words.some(word => !word.tokens.length) || !Number.isFinite(frameSeconds) || frameSeconds <= 0) throw ValidationError('CTC alignment requires acoustic frames, nonempty tokenized words, and a positive frame duration.')
  const tokens: number[] = [], wordRanges: Array<[number, number]> = []
  for (const word of words) {
    if (tokens.length && separator !== undefined) tokens.push(separator)
    const first = tokens.length
    tokens.push(...word.tokens)
    wordRanges.push([first, tokens.length])
  }
  const states = tokens.length * 2 + 1
  const vocabulary = frames[0]!.length
  if (!Number.isInteger(blank) || blank < 0 || blank >= vocabulary || tokens.some(token => !Number.isInteger(token) || token < 0 || token >= vocabulary || token === blank)) throw ValidationError('CTC transcript contains an invalid or blank label.')
  if (frames.length * states > 30_000_000) throw ValidationError('CTC alignment exceeds 30 million states. Split the transcript into shorter non-overlapping segments.')
  if (frames.some(frame => frame.length !== vocabulary || frame.some(score => !Number.isFinite(score) || score > 1e-5))) throw ValidationError('CTC emissions must be a rectangular matrix of finite log probabilities.')
  const history = new Uint8Array(frames.length * states)
  let previous = new Float64Array(states).fill(-Infinity)
  previous[0] = 0
  for (let time = 0; time < frames.length; time++) {
    const current = new Float64Array(states).fill(-Infinity)
    for (let state = 0; state < states; state++) {
      const label = state % 2 ? tokens[(state - 1) / 2]! : blank
      let best = previous[state]!, step = 0
      if (state > 0 && previous[state - 1]! > best) { best = previous[state - 1]!; step = 1 }
      if (state > 1 && state % 2 === 1 && label !== tokens[(state - 3) / 2] && previous[state - 2]! > best) { best = previous[state - 2]!; step = 2 }
      current[state] = best + frames[time]![label]!
      history[time * states + state] = step
    }
    previous = current
  }
  let state = previous[states - 1]! > previous[states - 2]! ? states - 1 : states - 2
  if (!Number.isFinite(previous[state])) throw ValidationError('Audio contains too few acoustic frames for the transcript, including repeated labels.')
  const spans = tokens.map(() => ({ first: Infinity, last: -1, score: 0, count: 0 }))
  for (let time = frames.length - 1; time >= 0; time--) {
    if (state % 2) {
      const index = (state - 1) / 2, span = spans[index]!
      span.first = Math.min(span.first, time); span.last = Math.max(span.last, time)
      span.score += frames[time]![tokens[index]!]!; span.count++
    }
    state -= history[time * states + state]!
  }
  return words.map((word, index) => {
    const range = wordRanges[index]!
    const selected = spans.slice(range[0], range[1])
    if (selected.some(span => !span.count)) throw ValidationError('CTC alignment failed to cover every transcript label.')
    return { text: word.text, startSeconds: selected[0]!.first * frameSeconds, endSeconds: (selected.at(-1)!.last + 1) * frameSeconds,
      confidence: Math.exp(selected.reduce((sum, span) => sum + span.score, 0) / selected.reduce((sum, span) => sum + span.count, 0)) }
  })
}
