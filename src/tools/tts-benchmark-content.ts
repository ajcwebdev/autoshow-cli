import { UsageError } from '~/utils/error-handler'

// Benchmark vocabulary only, not a claim that Eleven's tag vocabulary is exhaustive.
const ELEVEN_BENCHMARK_TAGS = new Set(['whispers', 'sarcastic', 'excited', 'angry', 'sad', 'normal pace', 'slow', 'fast', 'short pause', 'long pause'])

export const validateTtsBenchmarkContent = (entry: { id: string, provider: string, lines: readonly string[], spokenLines: readonly string[] }): void => {
  if (entry.lines.length !== 5 || entry.spokenLines.length !== 5) throw UsageError(`Benchmark ${entry.id} requires five separate spoken lines.`)
  for (const [index, line] of entry.lines.entries()) {
    if (entry.provider === 'elevenlabs') {
      for (const tag of line.matchAll(/\[([^\]]*)\]/g)) {
        if (!ELEVEN_BENCHMARK_TAGS.has(tag[1]!)) throw UsageError(`Benchmark ${entry.id} contains an unreviewed Eleven tag: ${tag[1]}. Instructions must not be converted to bracketed prose.`)
      }
    }
    const spoken = line.replace(/\[[^\]]*\]/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    if (!spoken || spoken !== entry.spokenLines[index]?.replace(/\s+/g, ' ').trim()) throw UsageError(`Benchmark ${entry.id} line ${index + 1} changes the canonical spoken words.`)
  }
}
