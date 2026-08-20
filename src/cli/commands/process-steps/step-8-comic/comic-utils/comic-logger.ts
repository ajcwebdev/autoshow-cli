import * as v from 'valibot'
import * as appLog from '~/utils/app-logger/app-logger'
import { formatDuration as formatSharedDuration } from '~/utils/app-logger/formatters'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'

/**
 * Comic's compact log surface.
 *
 * It stays a thin wrapper — the one-line `label key=value` shape is comic's deliberate
 * output contract — but it no longer competes with the canonical logger:
 *   - the writer is named `comicWrite`, not `l`, so `import { l }` inside step-8-comic can
 *     only ever be the global logger;
 *   - `.dim()` is gone (it was identical to the plain call, so the name lied);
 *   - `bold()`/`cyan()` are gone: they baked ANSI into the message string before it reached
 *     the sink, which is the one place styling belongs — the JSON sink was receiving
 *     escape codes that redaction and --no-color could not cleanly strip.
 */
export const formatDuration = formatSharedDuration

export const formatCompactCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

const compactParts = (
  parts: Array<string | number | false | null | undefined>
): string => {
  return parts
    .filter((part): part is string | number => part !== false && part !== null && part !== undefined && String(part).length > 0)
    .map(String)
    .join(' ')
}

const comicWrite = (...messages: unknown[]): void => {
  appLog.write('info', messages.map(String).join(' '), { category: 'command' })
}

comicWrite.success = (message: string): void => {
  appLog.write('success', message, { category: 'command' })
}

export { comicWrite }

// The shared image services emit their own "Image Status/Result" lines (category
// 'pipeline') that point at the scratch directory comic runs each image in and then
// deletes. Comic already prints an authoritative per-image line with the real output path,
// so these interim logs are redundant and the scratch path is actively confusing.
//
// This used to be done by monkey-patching `appLog.l.config.sinks` in place, wrapping each
// sink to drop the category. The logger now has first-class category filtering, so the
// suppression happens before any sink is reached and derived loggers observe it too.
//
// Scoped to the run rather than applied process-wide: the CLI dispatcher gives each command
// a clean slate, but these command functions are also called directly (by other commands
// and by tests), where a permanent mutation would silently mute an unrelated caller.
export const withSuppressedPipelineLogs = async <T>(run: () => Promise<T>): Promise<T> => {
  const restore = appLog.suppressLogCategories(['pipeline'])
  try {
    return await run()
  } finally {
    restore()
  }
}

export const comicLog = {
  header(command: string, details: Array<string | number | false | null | undefined> = []): void {
    comicWrite(`${command}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  line(label: string, details: Array<string | number | false | null | undefined> = []): void {
    comicWrite(`${label}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  output(
    status: 'generated' | 'skipped' | 'combined',
    kind: string,
    details: Array<string | number | false | null | undefined>
  ): void {
    comicWrite(compactParts([status, kind, ...details]))
  },

  summary(details: Array<string | number | false | null | undefined>): void {
    comicWrite(compactParts(['summary', ...details]))
  },

  outputDirectory(path: string): void {
    comicWrite(`output directory: ${path}`)
  },
}

const errBase = (...messages: unknown[]): void => {
  if (messages.length === 1 && v.isValiError(messages[0])) {
    errValidation(messages[0])
    return
  }

  appLog.error(messages.map(String).join(' '))
}

const flattenValidationIssues = (
  error: v.ValiError<v.GenericSchema | v.GenericSchemaAsync>
): Array<{ path: string, message: string }> => {
  const issues = Array.isArray(error.issues) ? error.issues : []
  if (issues.length === 0) {
    return [{ path: '', message: error.message }]
  }

  const flatErrors = v.flatten(issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]])
  return [
    ...(flatErrors.root ?? []).map((message) => ({ path: '', message })),
    ...Object.entries(flatErrors.nested ?? {}).flatMap(([path, messages]) =>
      (messages ?? []).map((message) => ({ path, message }))
    )
  ]
}

// One event carrying every issue, rendered as a table by the human sink, instead of one
// hand-indented `l.error` line per issue with no structure for the JSON sink to emit.
const errValidation = (error: v.ValiError<v.GenericSchema | v.GenericSchemaAsync>): void => {
  const issues = flattenValidationIssues(error)
  appLog.write('error', 'Validation error', {
    category: 'command',
    metadata: { issues },
    humanTable: createHumanTable(
      issues.map(({ path, message }) => ({ path: path || '(root)', message })),
      ['path', 'message']
    )
  })
}

export const err = errBase
