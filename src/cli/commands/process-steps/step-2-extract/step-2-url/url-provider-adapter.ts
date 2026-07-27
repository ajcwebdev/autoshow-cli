import type { CapabilityTarget, UrlArticleProviderCapability, UrlArticleRunOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

const hasValues = (values: string[] | undefined): boolean =>
  Array.isArray(values) && values.some(value => value.trim().length > 0)

const hasBrowserActions = (actions: unknown[] | undefined): boolean =>
  Array.isArray(actions) && actions.length > 0

const requiresCapability = (
  adapter: CapabilityTarget,
  capability: UrlArticleProviderCapability,
  optionName: string
): void => {
  if (!adapter.capabilities.includes(capability)) {
    throw CLIUsageError(`${adapter.displayName} does not support URL article option "${optionName}".`)
  }
}

export const assertUrlArticleOptionsSupported = (
  adapter: CapabilityTarget,
  options: UrlArticleRunOptions | undefined
): void => {
  if (!options) {
    return
  }

  if (options.contentScope === 'full') {
    requiresCapability(adapter, 'full-content', 'contentScope=full')
  }
  if (hasValues(options.includeSelectors) || hasValues(options.excludeSelectors)) {
    requiresCapability(adapter, 'selectors', 'selectors')
  }
  if (typeof options.waitMs === 'number') {
    requiresCapability(adapter, 'wait', 'waitMs')
  }
  if (typeof options.timeoutMs === 'number') {
    requiresCapability(adapter, 'timeout', 'timeoutMs')
  }
  if (options.geo?.country) {
    requiresCapability(adapter, 'geo', 'geo.country')
  }
  if (hasValues(options.geo?.languages) || options.geo?.locale) {
    requiresCapability(adapter, 'locale', 'geo.locale')
  }
  if (options.structuredExtraction === true) {
    requiresCapability(adapter, 'structured-extraction', 'structuredExtraction')
  }
  if (options.screenshot === true) {
    requiresCapability(adapter, 'screenshot', 'screenshot')
  }
  if (options.batch === true) {
    requiresCapability(adapter, 'batch', 'batch')
  }
  if (options.crawl === true) {
    requiresCapability(adapter, 'crawl', 'crawl')
  }
  if (options.map === true) {
    requiresCapability(adapter, 'map', 'map')
  }
  if (options.search === true) {
    requiresCapability(adapter, 'search', 'search')
  }
  if (hasBrowserActions(options.browserActions)) {
    requiresCapability(adapter, 'browser-actions', 'browserActions')
  }
}
