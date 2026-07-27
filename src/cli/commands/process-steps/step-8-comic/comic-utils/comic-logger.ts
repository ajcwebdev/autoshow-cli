import * as v from 'valibot'
import * as appLog from '~/utils/app-logger/app-logger'
import { formatDuration as formatSharedDuration } from '~/utils/app-logger/formatters'
import { paint, terminalStyles } from '~/utils/terminal-colors'
import type { LogSink } from '~/types'

export const bold = (text: string): string => {
  return paint(text, 'white')
}

export const cyan = (text: string): string => {
  return terminalStyles.info(text)
}

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

const logBase = (...messages: unknown[]): void => {
  appLog.write('info', messages.map(String).join(' '), { category: 'command' })
}

logBase.dim = (...messages: unknown[]): void => {
  appLog.write('info', messages.map(String).join(' '), { category: 'command' })
}

logBase.success = (message: string): void => {
  appLog.write('success', message, { category: 'command' })
}

export const l = logBase

// The shared image services emit their own "Image Status/Result" lines
// (category 'pipeline') that point at the scratch directory comic runs each image
// in and then deletes. Comic already prints an authoritative per-image line with
// the real output path, so these interim logs are redundant and the scratch path
// is actively confusing. Filter category 'pipeline' out of the active sinks once
// per command. It is idempotent (wrapped sinks are tagged) and concurrency-safe
// because it only rewrites sink output, not shared per-call state.
const PIPELINE_SINK_FILTERED = Symbol('comicPipelineSinkFiltered')

export const suppressSharedPipelineLogs = (): void => {
  const sinks = appLog.l.config.sinks
  for (let index = 0; index < sinks.length; index++) {
    const sink = sinks[index]
    if (!sink || (sink as { [PIPELINE_SINK_FILTERED]?: boolean })[PIPELINE_SINK_FILTERED]) {
      continue
    }

    const filtered: LogSink = (event) => {
      if (event.category === 'pipeline') return
      sink(event)
    }
    ;(filtered as { [PIPELINE_SINK_FILTERED]?: boolean })[PIPELINE_SINK_FILTERED] = true
    sinks[index] = filtered
  }
}

export const comicLog = {
  header(command: string, details: Array<string | number | false | null | undefined> = []): void {
    l(`${bold(command)}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  line(label: string, details: Array<string | number | false | null | undefined> = []): void {
    l.dim(`${label}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  output(
    status: 'generated' | 'skipped' | 'combined',
    kind: string,
    details: Array<string | number | false | null | undefined>
  ): void {
    l.dim(compactParts([status, kind, ...details]))
  },

  summary(details: Array<string | number | false | null | undefined>): void {
    l.dim(compactParts(['summary', ...details]))
  },

  outputDirectory(path: string): void {
    l.dim(`output directory: ${path}`)
  },
}

const errBase = (...messages: unknown[]): void => {
  if (messages.length === 1 && v.isValiError(messages[0])) {
    errValidation(messages[0])
    return
  }

  appLog.error(messages.map(String).join(' '))
}

const errValidation = (error: v.ValiError<v.GenericSchema | v.GenericSchemaAsync>): void => {
  errBase('Validation error:')

  const issues = Array.isArray(error.issues) ? error.issues : []

  if (issues.length === 0) {
    errBase(`  - ${error.message}`)
    return
  }

  const flatErrors = v.flatten(issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]])

  if (flatErrors.root) {
    flatErrors.root.forEach(msg => errBase(`  - ${msg}`))
  }

  if (flatErrors.nested) {
    Object.entries(flatErrors.nested).forEach(([path, messages]) => {
      if (messages) {
        messages.forEach(msg => errBase(`  - ${path}: ${msg}`))
      }
    })
  }
}

export const err = errBase
