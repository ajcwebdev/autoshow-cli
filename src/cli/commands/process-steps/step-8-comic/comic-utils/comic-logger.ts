import * as v from 'valibot'
import * as appLog from '~/utils/app-logger/app-logger'
import { formatDuration as formatSharedDuration } from '~/utils/app-logger/formatters'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'

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
    appLog.write('info', `${command}${details.length > 0 ? ` ${compactParts(details)}` : ''}`, { category: 'command' })
  },

  line(label: string, details: Array<string | number | false | null | undefined> = []): void {
    appLog.write('info', `${label}${details.length > 0 ? ` ${compactParts(details)}` : ''}`, { category: 'command' })
  },

  output(
    status: 'generated' | 'skipped' | 'combined',
    kind: string,
    details: Array<string | number | false | null | undefined>
  ): void {
    appLog.write('info', compactParts([status, kind, ...details]), { category: 'command' })
  },

  summary(details: Array<string | number | false | null | undefined>): void {
    appLog.write('info', compactParts(['summary', ...details]), { category: 'command' })
  },

  outputDirectory(path: string): void {
    appLog.write('info', `output directory: ${path}`, { category: 'command' })
  },
}

const errBase = (...messages: unknown[]): void => {
  if (messages.length === 1 && v.isValiError(messages[0])) {
    errValidation(messages[0])
    return
  }

  appLog.error(messages.map(String).join(' '), { category: 'command' })
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
