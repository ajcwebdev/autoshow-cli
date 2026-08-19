import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import modelLinks from '~/cli/commands/setup-and-utilities/links/model-links'
import type { ProviderSections } from '~/types'

/**
 * These fixtures are DERIVED from the link registry, never hand-mirrored.
 *
 * They used to be hand-copied URL lists, which meant every model refresh silently
 * desynced them from `model-links/*.json` and the drift only surfaced as a wall of
 * failing assertions much later. The selector tests exist to pin `parseLinksArgv` +
 * `collectLinks` — which provider/section a flag resolves to, in what order, deduped —
 * not to restate the registry's contents. So the expected values are computed here by
 * a deliberately independent reduction over the raw JSON files.
 *
 * URLs come from disk rather than from the merged production export, so a file that
 * exists but was never wired into `model-links.ts` is visible to these fixtures; the
 * registry-integrity contracts assert the two views agree.
 */

export const MODEL_LINKS_DIR = 'src/cli/commands/setup-and-utilities/links/model-links'

const readManifestsFromDisk = (): Map<string, ProviderSections> => {
  const byProvider = new Map<string, ProviderSections>()
  for (const fileName of readdirSync(MODEL_LINKS_DIR).filter(file => file.endsWith('.json')).sort()) {
    const manifest = JSON.parse(readFileSync(join(MODEL_LINKS_DIR, fileName), 'utf8')) as Record<string, ProviderSections>
    for (const [provider, sections] of Object.entries(manifest)) {
      byProvider.set(provider, sections)
    }
  }
  return byProvider
}

export const DISK_MANIFESTS = readManifestsFromDisk()

// `collectLinks` walks providers in the merged registry's key order, which is the order
// `model-links.ts` lists them in — not the alphabetical file order used above.
export const REGISTRY_PROVIDER_ORDER = Object.keys(modelLinks as Record<string, ProviderSections>)

const sectionsFor = (provider: string): ProviderSections => {
  const sections = DISK_MANIFESTS.get(provider)
  if (!sections) {
    throw new Error(`No links manifest on disk declares provider "${provider}"`)
  }
  return sections
}

/** URLs a single `--<provider> <section>` selection resolves to. */
export const sectionLinks = (provider: string, section: string): string[] => {
  const urls = sectionsFor(provider)[section]
  if (!urls) {
    throw new Error(`Provider "${provider}" has no "${section}" section on disk`)
  }
  return [...new Set(urls)]
}

/** URLs a bare `--<provider>` selection resolves to: every section, in declared order. */
export const providerLinks = (provider: string): string[] =>
  [...new Set(Object.values(sectionsFor(provider)).flat())]

/** URLs a global `<section>` selection resolves to, across providers in registry order. */
export const globalSectionLinks = (section: string): string[] =>
  [...new Set(
    REGISTRY_PROVIDER_ORDER.flatMap(provider => DISK_MANIFESTS.get(provider)?.[section] ?? [])
  )]
