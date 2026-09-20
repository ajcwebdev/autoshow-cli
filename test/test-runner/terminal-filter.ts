import { stripAnsi } from '~/utils/terminal-colors'

/**
 * Terminal view of the `bun test` stream. Passing and skipped result lines are
 * the bulk of a full run, so they stay in runner.log only; file headers are
 * printed just before a line that is worth reading (a failure, an error block,
 * or leaked output). Counts feed the quiet-run progress heartbeat.
 */
export type TerminalFilter = {
  push: (line: string) => string[]
  counts: () => { passed: number, failed: number, skipped: number }
  lastOutputAtMs: () => number
}

const FILE_HEADER_PATTERN = /^\S.*\.(?:test|spec)\.[cm]?[jt]sx?:$/
const PASS_PATTERN = /^(?:✓|\(pass\))\s/
const SKIP_PATTERN = /^(?:»|\(skip\)|\(todo\))\s/
const FAIL_PATTERN = /^(?:✗|\(fail\))\s/
const SKIPPED_LIST_PATTERN = /^\d+ tests? (?:skipped|todo):$/
const SUMMARY_START_PATTERN = /^(?:\d+ tests? (?:skipped|failed|todo):|\s*\d+ pass)$/

const plain = (line: string): string => stripAnsi(line).replace(/\r?\n$/, '')

export const createTerminalFilter = (
  options: { verbose?: boolean, now?: () => number } = {}
): TerminalFilter => {
  const now = options.now ?? Date.now
  const counts = { passed: 0, failed: 0, skipped: 0 }
  let inSummary = false
  let pending: string[] = []
  let lastOutputAt = now()

  const emit = (lines: string[]): string[] => {
    if (lines.length > 0) lastOutputAt = now()
    return lines
  }

  const count = (text: string): void => {
    if (inSummary) return
    if (PASS_PATTERN.test(text)) counts.passed++
    else if (SKIP_PATTERN.test(text)) counts.skipped++
    else if (FAIL_PATTERN.test(text)) counts.failed++
  }

  const push = (line: string): string[] => {
    const text = plain(line)
    if (SUMMARY_START_PATTERN.test(text)) inSummary = true
    count(text)
    if (options.verbose) return emit([line])

    if (text.trim().length === 0) {
      pending = [line]
      return []
    }
    if (FILE_HEADER_PATTERN.test(text)) {
      pending = [...(pending.length === 1 && plain(pending[0] ?? '').trim().length === 0 ? pending : []), line]
      return []
    }
    if (PASS_PATTERN.test(text) || SKIP_PATTERN.test(text) || SKIPPED_LIST_PATTERN.test(text)) {
      return []
    }
    const out = [...pending, line]
    pending = []
    return emit(out)
  }

  return {
    push,
    counts: () => ({ ...counts }),
    lastOutputAtMs: () => lastOutputAt,
  }
}

export const formatProgressLine = (
  counts: { passed: number, failed: number, skipped: number },
  elapsedMs: number
): string =>
  `progress: ${counts.passed} passed · ${counts.failed} failed · ${counts.skipped} skipped · ${Math.round(elapsedMs / 1000)}s`
