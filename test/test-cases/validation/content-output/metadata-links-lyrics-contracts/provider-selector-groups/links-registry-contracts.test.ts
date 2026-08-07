import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import modelLinks from '~/cli/commands/setup-and-utilities/links/model-links'
import { DISK_MANIFESTS, MODEL_LINKS_DIR } from './fixtures/registry'

// The selector fixtures are derived from this registry rather than mirroring it by hand,
// so these contracts are what actually guard its contents. Each one covers a way the
// registry can go wrong that `collectLinks` would otherwise absorb silently.

const manifestFiles = (): string[] =>
  readdirSync(MODEL_LINKS_DIR).filter(file => file.endsWith('.json')).sort()

const readManifest = (fileName: string): Record<string, Record<string, string[]>> =>
  JSON.parse(readFileSync(join(MODEL_LINKS_DIR, fileName), 'utf8')) as Record<string, Record<string, string[]>>

// `model-links.ts` merges a hand-written import list. A new manifest file that nobody
// added to that list loads fine, ships in the repo, and is silently never served.
test('every links manifest on disk is registered in the merged registry', () => {
  const registered = modelLinks as Record<string, Record<string, string[]>>

  expect(Object.keys(registered).sort()).toEqual([...DISK_MANIFESTS.keys()].sort())

  for (const [provider, sections] of DISK_MANIFESTS) {
    expect(registered[provider]).toEqual(sections)
  }
})

// The merge is `Object.assign`, so two files claiming one provider silently drop one.
test('no provider is declared by more than one links manifest', () => {
  const owners = new Map<string, string>()
  const conflicts: string[] = []

  for (const fileName of manifestFiles()) {
    for (const provider of Object.keys(readManifest(fileName))) {
      const previous = owners.get(provider)
      if (previous) {
        conflicts.push(`${provider} (${previous}, ${fileName})`)
      } else {
        owners.set(provider, fileName)
      }
    }
  }

  expect(conflicts).toEqual([])
})

// `--provider <section>` is meant to be a partition. A URL owned by two sections is
// fetched under both, and section-scoped output stops meaning what its name says.
test('raw link manifests do not repeat URLs across categories', () => {
  const seen = new Map<string, string>()
  const duplicates: string[] = []

  for (const fileName of manifestFiles()) {
    for (const [providerName, sections] of Object.entries(readManifest(fileName))) {
      for (const [sectionName, urls] of Object.entries(sections)) {
        for (const url of urls) {
          const owner = `${providerName}/${sectionName}`
          const previousOwner = seen.get(url)
          if (previousOwner) {
            duplicates.push(`${url} (${previousOwner}, ${owner})`)
          } else {
            seen.set(url, owner)
          }
        }
      }
    }
  }

  expect(duplicates).toEqual([])
})

test('link sections are non-empty and free of repeats within themselves', () => {
  const offenders: string[] = []

  for (const [provider, sections] of DISK_MANIFESTS) {
    for (const [section, urls] of Object.entries(sections)) {
      if (urls.length === 0) {
        offenders.push(`${provider}/${section} is empty`)
      }
      if (new Set(urls).size !== urls.length) {
        offenders.push(`${provider}/${section} repeats a URL`)
      }
    }
  }

  expect(offenders).toEqual([])
})

/**
 * The curated registry must hold canonical URLs.
 *
 * `blob:` is deliberately supported at the fetch layer — `getFetchableDocumentationUrl`
 * strips the prefix — but that exists for URLs a user pastes in via direct-URL or
 * input-file mode, straight out of a browser. It is not a form anything should be
 * committed in, and this contract is what keeps the two apart.
 *
 * It caught a real case: every entry in `scrapecreators.json` was a `blob:` handle
 * captured from a devtools panel. They resolved — the prefix got stripped and the
 * requests returned 200 — but each opaque UUID path fell through the docs site's
 * catch-all route and served the same generic introduction page, so all three sections
 * fetched identical content instead of the endpoints they named. Silent wrong content,
 * not a hard failure, which is why nothing surfaced it.
 */
test('every registered link is an absolute http(s) URL', () => {
  const offenders: string[] = []

  for (const [provider, sections] of DISK_MANIFESTS) {
    for (const [section, urls] of Object.entries(sections)) {
      for (const url of urls) {
        if (!/^https?:\/\/\S+$/.test(url)) {
          offenders.push(`${provider}/${section}: ${url}`)
        }
      }
    }
  }

  expect(offenders).toEqual([])
})
