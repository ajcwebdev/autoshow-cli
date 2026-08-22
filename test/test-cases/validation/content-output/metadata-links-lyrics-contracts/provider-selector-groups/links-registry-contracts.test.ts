import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import modelLinks from '~/cli/commands/setup-and-utilities/links/model-links'
import { DISK_MANIFESTS, MODEL_LINKS_DIR } from './fixtures/registry'

const manifestFiles = (): string[] =>
  readdirSync(MODEL_LINKS_DIR).filter(file => file.endsWith('.json')).sort()

const readManifest = (fileName: string): Record<string, Record<string, string[]>> =>
  JSON.parse(readFileSync(join(MODEL_LINKS_DIR, fileName), 'utf8')) as Record<string, Record<string, string[]>>

test('every links manifest on disk is registered in the merged registry', () => {
  const registered = modelLinks as Record<string, Record<string, string[]>>

  expect(Object.keys(registered).sort()).toEqual([...DISK_MANIFESTS.keys()].sort())

  for (const [provider, sections] of DISK_MANIFESTS) {
    expect(registered[provider]).toEqual(sections)
  }
})

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
