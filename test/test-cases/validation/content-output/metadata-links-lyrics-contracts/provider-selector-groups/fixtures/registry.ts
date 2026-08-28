import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import modelLinks from '~/cli/commands/setup-and-utilities/links/model-links'
import type { ProviderSections } from '~/types'

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

const REGISTRY_PROVIDER_ORDER = Object.keys(modelLinks as Record<string, ProviderSections>)

const sectionsFor = (provider: string): ProviderSections => {
  const sections = DISK_MANIFESTS.get(provider)
  if (!sections) {
    throw new Error(`No links manifest on disk declares provider "${provider}"`)
  }
  return sections
}

export const sectionLinks = (provider: string, section: string): string[] => {
  const urls = sectionsFor(provider)[section]
  if (!urls) {
    throw new Error(`Provider "${provider}" has no "${section}" section on disk`)
  }
  return [...new Set(urls)]
}

export const providerLinks = (provider: string): string[] =>
  [...new Set(Object.values(sectionsFor(provider)).flat())]

export const globalSectionLinks = (section: string): string[] =>
  [...new Set(
    REGISTRY_PROVIDER_ORDER.flatMap(provider => DISK_MANIFESTS.get(provider)?.[section] ?? [])
  )]
