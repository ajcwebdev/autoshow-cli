import type { LinksRefreshLinkMetadata } from '~/types'

export type LinksLineDiffOp = { kind: 'equal' | 'remove' | 'add', line: string }

export type LinksLinkChange = { linesAdded: number, linesRemoved: number, rendered: string }

const BUNDLE_MARKER = /^<!-- (?:Source: |Failed to fetch |Empty response from )(.+?) -->$/
const MAX_EDIT_DISTANCE = 1500
const MAX_RENDERED_DIFF_LINES = 300
const MAX_LINE_LENGTH = 300
const CONTEXT_LINES = 2

// The previous run's page bodies are already on disk in the bundle this run is about to overwrite, one section per
// `<!-- Source: url -->` marker, so a diff needs no second copy of the content.
export const splitLinksBundle = (bundle: string): Map<string, string> => {
  const sections = new Map<string, string>()
  let currentUrl: string | undefined
  let isSource = false
  let lines: string[] = []
  const flush = (): void => {
    if (currentUrl !== undefined && isSource) sections.set(currentUrl, lines.join('\n').trim())
  }
  for (const line of bundle.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = BUNDLE_MARKER.exec(line)
    if (!marker) {
      lines.push(line)
      continue
    }
    flush()
    currentUrl = marker[1]
    isSource = line.startsWith('<!-- Source: ')
    lines = []
  }
  flush()
  return sections
}

const backtrack = (trace: Int32Array[], before: string[], after: string[]): LinksLineDiffOp[] => {
  const ops: LinksLineDiffOp[] = []
  let x = before.length
  let y = after.length
  for (let d = trace.length - 1; d >= 0; d--) {
    const snapshot = trace[d]!
    const at = (k: number): number => snapshot[k + d + 1] ?? 0
    const k = x - y
    const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1
    const previousX = at(previousK)
    const previousY = previousX - previousK
    while (x > previousX && y > previousY) {
      ops.push({ kind: 'equal', line: before[x - 1]! })
      x--
      y--
    }
    if (d === 0) break
    if (x === previousX) {
      ops.push({ kind: 'add', line: after[y - 1]! })
      y--
    } else {
      ops.push({ kind: 'remove', line: before[x - 1]! })
      x--
    }
  }
  return ops.reverse()
}

// Myers O(ND) diff. Round d keeps a snapshot of the furthest-reaching x for diagonals -d-1..d+1, which is all the
// backtrack reads, so memory grows with the square of the edit distance rather than with document size.
const diffMiddle = (before: string[], after: string[]): LinksLineDiffOp[] | undefined => {
  const n = before.length
  const m = after.length
  if (n === 0) return after.map(line => ({ kind: 'add', line }))
  if (m === 0) return before.map(line => ({ kind: 'remove', line }))
  const max = Math.min(n + m, MAX_EDIT_DISTANCE)
  const offset = max + 1
  const furthest = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  for (let d = 0; d <= max; d++) {
    trace.push(furthest.slice(offset - d - 1, offset + d + 2))
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && furthest[offset + k - 1]! < furthest[offset + k + 1]!)
      let x = down ? furthest[offset + k + 1]! : furthest[offset + k - 1]! + 1
      let y = x - k
      while (x < n && y < m && before[x] === after[y]) {
        x++
        y++
      }
      furthest[offset + k] = x
      if (x >= n && y >= m) return backtrack(trace, before, after)
    }
  }
  return undefined
}

// Returns undefined when the two texts differ by more than MAX_EDIT_DISTANCE lines; callers summarise instead.
export const diffLines = (before: string[], after: string[]): LinksLineDiffOp[] | undefined => {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--
    afterEnd--
  }
  const middle = diffMiddle(before.slice(start, beforeEnd), after.slice(start, afterEnd))
  if (!middle) return undefined
  const equal = (line: string): LinksLineDiffOp => ({ kind: 'equal', line })
  return [...before.slice(0, start).map(equal), ...middle, ...before.slice(beforeEnd).map(equal)]
}

// A minified JSON spec is one line of 100 KB; show the window around the first difference instead.
const clipLine = (line: string, counterpart?: string): string => {
  if (line.length <= MAX_LINE_LENGTH) return line
  if (counterpart === undefined) return `${line.slice(0, MAX_LINE_LENGTH)}…`
  let prefix = 0
  while (prefix < line.length && prefix < counterpart.length && line[prefix] === counterpart[prefix]) prefix++
  const from = Math.max(0, prefix - 60)
  const to = Math.min(line.length, from + MAX_LINE_LENGTH)
  return `${from > 0 ? '…' : ''}${line.slice(from, to)}${to < line.length ? '…' : ''}`
}

// Within each block of consecutive edits, the i-th removed line is paired with the i-th added line so that a long
// line can be clipped at the point where the two differ.
const pairCounterparts = (ops: LinksLineDiffOp[]): (string | undefined)[] => {
  const counterparts = new Array<string | undefined>(ops.length).fill(undefined)
  let index = 0
  while (index < ops.length) {
    if (ops[index]!.kind === 'equal') {
      index++
      continue
    }
    const removed: number[] = []
    const added: number[] = []
    while (index < ops.length && ops[index]!.kind !== 'equal') {
      (ops[index]!.kind === 'remove' ? removed : added).push(index)
      index++
    }
    for (let pair = 0; pair < Math.min(removed.length, added.length); pair++) {
      counterparts[removed[pair]!] = ops[added[pair]!]!.line
      counterparts[added[pair]!] = ops[removed[pair]!]!.line
    }
  }
  return counterparts
}

const renderOps = (ops: LinksLineDiffOp[]): string[] => {
  const counterparts = pairCounterparts(ops)
  const keep = new Array<boolean>(ops.length).fill(false)
  ops.forEach((op, index) => {
    if (op.kind === 'equal') return
    for (let i = Math.max(0, index - CONTEXT_LINES); i <= Math.min(ops.length - 1, index + CONTEXT_LINES); i++) keep[i] = true
  })
  const rendered: string[] = []
  let beforeLine = 1
  let afterLine = 1
  let inHunk = false
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index]!
    if (keep[index]) {
      if (!inHunk) rendered.push(`@@ -${beforeLine} +${afterLine} @@`)
      inHunk = true
      if (op.kind === 'equal') rendered.push(` ${clipLine(op.line)}`)
      else rendered.push(`${op.kind === 'remove' ? '-' : '+'}${clipLine(op.line, counterparts[index])}`)
    } else {
      inHunk = false
    }
    if (op.kind !== 'add') beforeLine++
    if (op.kind !== 'remove') afterLine++
  }
  return rendered
}

const fenceFor = (lines: string[]): string => {
  const longest = Math.max(3, ...lines.flatMap(line => (line.match(/`+/g) ?? []).map(run => run.length)))
  return '`'.repeat(longest + 1)
}

const countUnmatchedLines = (from: string[], against: string[]): number => {
  const remaining = new Map<string, number>()
  for (const line of against) remaining.set(line, (remaining.get(line) ?? 0) + 1)
  let unmatched = 0
  for (const line of from) {
    const count = remaining.get(line) ?? 0
    if (count > 0) remaining.set(line, count - 1)
    else unmatched++
  }
  return unmatched
}

export const describeLinkChange = (previousBody: string, currentBody: string): LinksLinkChange => {
  const before = previousBody.split('\n')
  const after = currentBody.split('\n')
  const ops = diffLines(before, after)
  if (!ops) {
    return {
      linesAdded: countUnmatchedLines(after, before),
      linesRemoved: countUnmatchedLines(before, after),
      rendered: `Too different for a line diff: ${before.length} lines before, ${after.length} lines after.`
    }
  }
  const linesAdded = ops.filter(op => op.kind === 'add').length
  const linesRemoved = ops.filter(op => op.kind === 'remove').length
  if (linesAdded === 0 && linesRemoved === 0) {
    return { linesAdded, linesRemoved, rendered: 'No line differences; the change is in whitespace the hash normalises differently.' }
  }
  const lines = renderOps(ops)
  const shown = lines.slice(0, MAX_RENDERED_DIFF_LINES)
  const fence = fenceFor(shown)
  const omitted = lines.length - shown.length
  return {
    linesAdded,
    linesRemoved,
    rendered: [`${fence}diff`, ...shown, fence, ...(omitted > 0 ? [`… ${omitted} more diff lines omitted.`] : [])].join('\n')
  }
}

export type LinksChangeDescriber = (sourceUrl: string) => LinksLinkChange | undefined

// `previousBodies` and `currentBodies` hold the normalised markdown of each link, keyed by source URL. A link is
// diffed once, on first request, because only the metadata builder knows which links count as changed.
export const createLinkChangeDescriber = (
  previousBodies: ReadonlyMap<string, string>,
  currentBodies: ReadonlyMap<string, string>
): LinksChangeDescriber => {
  const described = new Map<string, LinksLinkChange | undefined>()
  return (sourceUrl) => {
    if (described.has(sourceUrl)) return described.get(sourceUrl)
    const previousBody = previousBodies.get(sourceUrl)
    const currentBody = currentBodies.get(sourceUrl)
    const change = previousBody === undefined || currentBody === undefined ? undefined : describeLinkChange(previousBody, currentBody)
    described.set(sourceUrl, change)
    return change
  }
}

export const renderLinksChangesReport = (
  links: readonly LinksRefreshLinkMetadata[],
  describeChange: LinksChangeDescriber,
  previousUrls: readonly string[],
  refreshedAt: string
): string => {
  const sections: string[] = []
  for (const link of links) {
    if (link.changeStatus !== 'changed') continue
    const tokens = `${link.previousTokenCount ?? '?'} -> ${link.tokenCount} tokens`
    const change = describeChange(link.sourceUrl)
    if (!change) {
      sections.push(`## ${link.sourceUrl}\n\n${tokens}. The previous bundle holds no section for this link, so there is nothing to diff against.`)
      continue
    }
    sections.push(`## ${link.sourceUrl}\n\n${tokens}, +${change.linesAdded} -${change.linesRemoved} lines\n\n${change.rendered}`)
  }

  const currentUrls = new Set(links.map(link => link.sourceUrl))
  const added = links.filter(link => link.changeStatus === 'new').map(link => link.sourceUrl)
  const dropped = previousUrls.filter(url => !currentUrls.has(url))
  const list = (title: string, urls: readonly string[]): string[] =>
    urls.length > 0 ? [`## ${title}\n\n${urls.map(url => `- ${url}`).join('\n')}`] : []

  const markdown = [
    `# Links refresh changes\n\nRefreshed ${refreshedAt}. ${sections.length} changed, ${added.length} new, ${dropped.length} no longer selected.`,
    ...sections,
    ...list('New links', added),
    ...list('No longer selected', dropped)
  ].join('\n\n')
  return `${markdown}\n`
}
