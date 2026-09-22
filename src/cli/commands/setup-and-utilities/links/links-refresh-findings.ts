import type { LinksRefreshFinding, LinksRefreshLinkMetadata, ModelLinksData } from '~/types'

const LOGIN_URL_PATTERN = /(?:^|[/._-])(?:login|log-in|signin|sign-in|sso|auth|docs-auth)(?:[/._?-]|$)/i
// A page that loses 40% of its tokens is reported. At 0.5 a page that halved to 50.1% went unreported.
const SHRUNK_TOKEN_RATIO = 0.6
// A conversion loss is an identifier the previous capture held, the page still has, and this run's markdown lacks.
// Calibrated on the converter regression that dropped Mistral's request parameters: affected pages lost 4 of 9,
// 5 of 17, and 11 of 41 identifiers, and unaffected pages lost none. Requiring the previous capture to have held
// the identifier keeps a new item in a related-models carousel, which a converter rightly drops, from counting.
const CONVERSION_MIN_LOST = 2
const CONVERSION_LOST_SHARE = 0.1
const CONVERSION_MIN_IDENTIFIERS = 5
const CONVERSION_DETAIL_IDENTIFIERS = 8

// Trailing slashes, a leading `www.`, and schemes differ between a configured URL and the page a provider serves it from.
export const normalizeLinkForComparison = (url: string): string => {
  try {
    const parsed = new URL(url.replace(/^blob:/i, ''))
    return `${parsed.host.toLowerCase().replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`
  } catch {
    return url
  }
}

const findConfiguredLocation = (registry: ModelLinksData, url: string): { provider: string, section: string } | undefined => {
  for (const [provider, sections] of Object.entries(registry)) {
    for (const [section, urls] of Object.entries(sections)) {
      if (urls.includes(url)) return { provider, section }
    }
  }
  return undefined
}

// A link can be fetched and hashed without being useful: it may have moved, landed on a sign-in page, or returned
// the same body as another link (a provider's fallback page answers 200 for paths that no longer exist).
export const collectLinksRefreshFindings = (
  entries: readonly LinksRefreshLinkMetadata[],
  registry: ModelLinksData
): LinksRefreshFinding[] => {
  const configuredTargets = new Map<string, string>()
  for (const url of [...Object.values(registry).flatMap(sections => Object.values(sections).flat()), ...entries.map(entry => entry.sourceUrl)]) {
    if (!configuredTargets.has(normalizeLinkForComparison(url))) configuredTargets.set(normalizeLinkForComparison(url), url)
  }
  const firstUrlByHash = new Map<string, string>()
  const findings: LinksRefreshFinding[] = []

  for (const entry of entries) {
    const report = (status: LinksRefreshFinding['status'], detail: string): void => {
      findings.push({ sourceUrl: entry.sourceUrl, ...findConfiguredLocation(registry, entry.sourceUrl), status, detail })
    }

    if (entry.status === 'failed') {
      const reason = entry.failureReason ?? 'fetch failed'
      report(/\bHTTP \d{3}\b/.test(reason) ? 'http-error' : 'fetch-failed', reason)
      continue
    }

    const movedTo = entry.finalUrl ? normalizeLinkForComparison(entry.finalUrl) : undefined
    if (entry.finalUrl && movedTo !== undefined && movedTo !== normalizeLinkForComparison(entry.sourceUrl)) {
      // A login wall answers 200 with a page body, so it has to be recognised before the content is trusted.
      if (LOGIN_URL_PATTERN.test(entry.finalUrl)) {
        report('login-redirect', entry.finalUrl)
        continue
      }
      const configured = configuredTargets.get(movedTo)
      report(configured && configured !== entry.sourceUrl ? 'duplicate-target' : 'redirect', entry.finalUrl)
    }

    if (entry.status === 'empty') {
      report('empty', 'The response body was empty.')
      continue
    }

    if (entry.contentHash !== null) {
      const sameBody = firstUrlByHash.get(entry.contentHash)
      if (sameBody) report('duplicate-content', sameBody)
      else firstUrlByHash.set(entry.contentHash, entry.sourceUrl)
    }

    if (entry.previousTokenCount !== undefined && entry.previousTokenCount > 0 && entry.tokenCount <= entry.previousTokenCount * SHRUNK_TOKEN_RATIO) {
      report('shrunk', `${entry.previousTokenCount} -> ${entry.tokenCount} tokens`)
    }

    // Hashes and token counts cannot tell a provider's edit from the converter dropping content. This can.
    const lost = entry.conversion?.lostIdentifiers ?? []
    if (
      entry.conversion && entry.conversion.identifierCount >= CONVERSION_MIN_IDENTIFIERS &&
      lost.length >= CONVERSION_MIN_LOST && lost.length / entry.conversion.identifierCount >= CONVERSION_LOST_SHARE
    ) {
      const named = lost.slice(0, CONVERSION_DETAIL_IDENTIFIERS).join(', ')
      const more = lost.length > CONVERSION_DETAIL_IDENTIFIERS ? `, and ${lost.length - CONVERSION_DETAIL_IDENTIFIERS} more` : ''
      report(
        'conversion-loss',
        `the page still has ${lost.length} of ${entry.conversion.identifierCount} identifiers that the previous capture held and this one lost: ${named}${more}`
      )
    }
  }

  return findings
}

export const renderLinksRefreshFindings = (findings: readonly LinksRefreshFinding[]): string => {
  const counts = Map.groupBy(findings, finding => finding.status)
  const summary = `${findings.length} link(s) need attention (${[...counts].map(([status, group]) => `${group.length} ${status}`).join(', ')})`
  const lines = findings.map(finding => {
    const location = finding.provider ? `${finding.provider}/${finding.section ?? ''}  ` : ''
    return `  ${finding.status.padEnd(17)} ${location}${finding.sourceUrl} -> ${finding.detail}`
  })
  return [summary, ...lines].join('\n')
}
