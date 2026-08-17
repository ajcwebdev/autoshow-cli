import type { HumanLogSection, HumanLogTable, HumanLogTableCell, LogContext, LogMetadata } from '~/types'

const REDACTED = 'REDACTED'

const SENSITIVE_FLAG_NAMES = new Set<string>([
  'password',
  'token',
  'api-key',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'cookie',
  'set-cookie',
  'credential',
  'credentials',
  'account',
  'account-id',
  'account_id',
  'organization',
  'organization-id',
  'organization_id',
  'org',
  'org-id',
  'org_id',
  'project',
  'project-id',
  'project_id',
  'request-id',
  'request_id',
  'traceparent',
  'traceresponse',
  'tracestate',
  'x-cloud-trace-context',
  'x-amzn-trace-id',
  'x-b3-traceid',
  'x-b3-spanid',
  'cf-ray',
  'trace-id',
  'trace_id',
  'secret',
  'hf-token',
  'openai-api-key',
  'anthropic-api-key',
  'gemini-api-key',
  'groq-api-key',
  'mistral-api-key',
  'assemblyai-api-key',
  'gladia-api-key',
  'happyscribe-api-key',
  'supadata-api-key',
  'scrapecreators-api-key',
  'elevenlabs-api-key',
  'minimax-api-key',
  'speechify-tts-consent-email'
])

const SENSITIVE_OBJECT_KEY_PATTERN = /(?:token|api[_-]?key|authorization|secret|password|cookie|credential|account[_-]?id|organization[_-]?id|project[_-]?id|request[_-]?id|trace[_-]?id|traceparent|traceresponse|tracestate|cloud[_-]?trace|amzn[_-]?trace|b3[_-]?(?:traceid|spanid)|cf[_-]?ray|^auth$|[_-]auth$|auth[_-])/i

const sanitizeHeaderAuthorization = (value: string): string => {
  return value
    .replace(/(authorization[:=]\s*(?:bearer|basic)\s+)([^\s"'`]+)/gi, '$1REDACTED')
    .replace(/(--header(?:=|\s+)(?:'|")?authorization:\s*(?:bearer|basic)\s+)([^\s"'`]+)/gi, '$1REDACTED')
    .replace(/("authorization"\s*:\s*"(?:bearer|basic)\s+)([^"]+)/gi, '$1REDACTED')
}

const sanitizeUrlCredentials = (value: string): string => {
  return value
    .replace(/(https?:\/\/[^\/\s:@]+:)([^@\/\s]+)@/gi, '$1REDACTED@')
    .replace(/(oauth2:)([^@\/\s]+)@/gi, '$1REDACTED@')
}

const sanitizeQuerySecrets = (value: string): string => {
  return value.replace(/([?&](?:token|access_token|auth|authorization|api_key|apikey|key|password|secret)=)([^&\s]+)/gi, '$1REDACTED')
}

const sanitizeEnvAssignments = (value: string): string => {
  return value
    .replace(/\b([A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|PASSWORD)[A-Z0-9_]*=)([^\s]+)/g, '$1REDACTED')
    .replace(/\bhf_[A-Za-z0-9]{20,}\b/g, 'hf_REDACTED')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-REDACTED')
}

const sanitizeEmailAddresses = (value: string): string =>
  value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')

// The opaque-id prefixes below (project, account, org, request, trace) are ordinary
// words that also appear in directory names, so the rule would otherwise corrupt real
// filesystem paths the user needs to be able to copy. Secret-shaped rules (token_, key_,
// sk-, jwt) still apply everywhere, including inside paths.
const isInsidePathToken = (source: string, offset: number): boolean => {
  const isBoundary = (char: string): boolean => char === '' || /\s|["'`]/.test(char)

  let start = offset
  while (start > 0 && !isBoundary(source[start - 1] ?? '')) {
    start -= 1
  }

  let end = offset
  while (end < source.length && !isBoundary(source[end] ?? '')) {
    end += 1
  }

  const token = source.slice(start, end)
  return token.includes('/') && !token.includes('://')
}

const sanitizeDiagnosticIdentifiers = (value: string): string => {
  return value
    .replace(/(["']?(?:account|account_id|account-id|organization|organization_id|organization-id|org|org_id|org-id|project|project_id|project-id|request_id|request-id|trace_id|trace-id|traceparent|traceresponse|tracestate|x-cloud-trace-context|x-amzn-trace-id|x-b3-traceid|x-b3-spanid|cf-ray|credential|credentials|cookie|set-cookie|api_key|api-key|secret|token|key)["']?\s*[:=]\s*["']?)([^"',\s}]+)/gi, '$1REDACTED')
    .replace(/\b[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}\b/gi, 'traceparent_REDACTED')
    .replace(/\b[0-9a-f]{32}\/\d+(?:;o=\d)?\b/gi, 'trace_REDACTED')
    .replace(/\b(?:acct|account|org|organization|proj|project|req|request|trace)[_-][A-Za-z0-9][A-Za-z0-9_-]{7,}\b/g, (match, offset: number, source: string) => {
      if (isInsidePathToken(source, offset)) {
        return match
      }
      const prefix = match.split(/[_-]/, 1)[0] ?? 'id'
      return `${prefix}_REDACTED`
    })
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, 'jwt_REDACTED')
    .replace(/\b(?:ak|pk|rk|key|cred|token)_[A-Za-z0-9_-]{16,}\b/gi, (match) => {
      const prefix = match.split('_', 1)[0] ?? 'key'
      return `${prefix}_REDACTED`
    })
}

export const sanitizeLogText = (value: string): string => {
  if (value.length === 0) {
    return value
  }

  return sanitizeEmailAddresses(
    sanitizeEnvAssignments(
      sanitizeDiagnosticIdentifiers(
        sanitizeQuerySecrets(
          sanitizeUrlCredentials(
            sanitizeHeaderAuthorization(value)
          )
        )
      )
    )
  )
}

const normalizeFlagName = (flagName: string): string => {
  return flagName.replace(/^--?/, '').toLowerCase()
}

const isSensitiveObjectKey = (key: string): boolean => {
  const normalized = normalizeFlagName(key)
  return SENSITIVE_FLAG_NAMES.has(normalized) || SENSITIVE_OBJECT_KEY_PATTERN.test(normalized)
}

const sanitizeUnknown = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (typeof value === 'string') {
    return sanitizeLogText(value)
  }

  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
    || value === undefined
    || typeof value === 'bigint'
  ) {
    return value
  }

  if (depth > 5) {
    return '[Truncated]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return sanitizeLogText(value.toString())
  }

  if (value instanceof Headers) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entryValue]) => [
        key,
        isSensitiveObjectKey(key) ? REDACTED : sanitizeUnknown(entryValue, depth + 1, seen)
      ])
    )
  }

  if (value instanceof Error) {
    if (seen.has(value)) {
      return { name: value.name, message: '[Circular]' }
    }
    seen.add(value)

    const out: Record<string, unknown> = {
      name: value.name,
      message: sanitizeLogText(value.message),
      ...(value.stack ? { stack: sanitizeLogText(value.stack) } : {})
    }

    for (const [key, entryValue] of Object.entries(value)) {
      if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') {
        continue
      }
      out[key] = isSensitiveObjectKey(key) ? REDACTED : sanitizeUnknown(entryValue, depth + 1, seen)
    }

    if ('cause' in value && value.cause !== undefined) {
      out['cause'] = sanitizeUnknown(value.cause, depth + 1, seen)
    }

    return out
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeUnknown(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    if (seen.has(objectValue)) {
      return '[Circular]'
    }
    seen.add(objectValue)

    const entries = Object.entries(objectValue)
    const out: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      out[key] = isSensitiveObjectKey(key) ? REDACTED : sanitizeUnknown(entryValue, depth + 1, seen)
    }

    return out
  }

  return sanitizeLogText(String(value))
}

const sanitizeLogValue = (value: unknown): unknown => {
  return sanitizeUnknown(value, 0, new WeakSet<object>())
}

export const sanitizeLogArgs = (args: readonly unknown[]): readonly unknown[] => {
  return args.map(arg => sanitizeLogValue(arg))
}

export const sanitizeLogContext = (context: LogContext): LogContext => {
  const sanitized: Record<string, string | number | boolean | null | undefined> = {}

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeLogText(value)
      continue
    }

    sanitized[key] = value
  }

  return sanitized
}

export const sanitizeLogMetadata = (metadata: LogMetadata): LogMetadata => {
  const sanitized = sanitizeLogValue(metadata)
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as LogMetadata
  }
  return {}
}

const sanitizeHumanTableCell = (value: HumanLogTableCell): HumanLogTableCell => {
  if (typeof value === 'string') {
    return sanitizeLogText(value)
  }

  return value
}

export const sanitizeHumanTable = (table: HumanLogTable): HumanLogTable => ({
  rows: table.rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [sanitizeLogText(key), sanitizeHumanTableCell(value)])
    ) as HumanLogTable['rows'][number]
  ),
  ...(table.columns ? { columns: table.columns.map(column => sanitizeLogText(column)) } : {}),
  ...(table.details
    ? {
        details: table.details.map(detail => ({
          label: sanitizeLogText(detail.label),
          value: sanitizeHumanTableCell(detail.value)
        }))
      }
    : {}),
  ...(table.align
    ? {
        align: Object.fromEntries(
          Object.entries(table.align).map(([column, align]) => [sanitizeLogText(column), align])
        )
      }
    : {}),
  ...(table.labels
    ? {
        labels: Object.fromEntries(
          Object.entries(table.labels).map(([column, label]) => [sanitizeLogText(column), sanitizeLogText(label)])
        )
      }
    : {})
})

export const sanitizeHumanSections = (
  sections: readonly HumanLogSection[]
): readonly HumanLogSection[] =>
  sections.map(section => ({
    title: sanitizeLogText(section.title),
    table: sanitizeHumanTable(section.table)
  }))
