const ANSI = /\x1b\[[0-9;]*m/g
export const helpVisibleLength = (value: string): number => value.replace(ANSI, '').length

export const resolveHelpWidth = (requested?: number): number => {
  const width = requested ?? (process.stdout.isTTY ? process.stdout.columns : 120)
  return Number.isFinite(width) ? Math.max(40, Math.floor(width!)) : 120
}

// Keep ANSI sequences and indivisible flag/model names intact. Pipe-delimited lists
// may wrap after a separator, so every accepted value remains copyable.
export const wrapHelpDescription = (prefix: string, description: string, width: number, continuation = ' '.repeat(helpVisibleLength(prefix))): string => {
  const output: string[] = []
  for (const [index, paragraph] of description.split('\n').entries()) {
    let line = index === 0 ? prefix : continuation
    let hasText = false
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap(word => word.match(/[^|]*\|\x1b\[[0-9;]*m|[^|]*\||[^|]+/g) ?? [])
    let previousEndedWithPipe = false
    for (const word of words) {
      const space = hasText && !previousEndedWithPipe ? ' ' : ''
      if (hasText && helpVisibleLength(line + space + word) > width) {
        output.push(line)
        line = continuation + word
      } else line += space + word
      hasText = true
      previousEndedWithPipe = word.replace(ANSI, '').endsWith('|')
    }
    output.push(line.trimEnd())
  }
  return output.join('\n')
}
