import { existsSync, readFileSync } from 'node:fs'
import * as v from 'valibot'
import type { CharacterReferenceConfig } from '~/types'
import * as appLog from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { toProjectRelativePath } from '~/utils/project-root'
import { CharacterReferenceSchema } from '../schemas/schemas'

import { fail } from './character-catalog-validation'

const RETIRED_CHARACTER_FIELDS = ['variantOf', 'distinguishFrom'] as const
const warnedRetiredFields = new Set<string>()

/** `variantOf` fed the retired blocking workflow and `distinguishFrom` only fed the retired image judge. Authored values are accepted, ignored and reported once per catalog path and field. */
const withoutRetiredCharacterFields = (value: unknown, configPath: string): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const characters = (value as { characters?: unknown }).characters
  if (!Array.isArray(characters)) return value
  const keysByField = new Map<string, string[]>()
  const stripped = characters.map(character => {
    if (typeof character !== 'object' || character === null) return character
    const rest: Record<string, unknown> = { ...(character as Record<string, unknown>) }
    for (const field of RETIRED_CHARACTER_FIELDS) {
      if (!Object.hasOwn(rest, field)) continue
      delete rest[field]
      keysByField.set(field, [...(keysByField.get(field) ?? []), typeof rest['key'] === 'string' ? rest['key'] : '?'])
    }
    return rest
  })
  if (keysByField.size === 0) return value
  const path = toProjectRelativePath(configPath)
  for (const [field, keys] of keysByField) {
    const warningKey = `${configPath}\0${field}`
    if (warnedRetiredFields.has(warningKey)) continue
    warnedRetiredFields.add(warningKey)
    appLog.write('warn', `Character catalog ${path} sets ${field} for ${keys.join(', ')}; ${field} is no longer read and can be removed`, { category: 'command', metadata: { path, field, characterKeys: keys } })
  }
  return { ...value, characters: stripped }
}

export const readCharacterCatalogConfig = (configPath: string) => {
  if (!existsSync(configPath)) {
    throw InfraError(
      `Character catalog not found at ${configPath}. Create characters-reference.json with schemaVersion 3; the bundled legacy catalog is no longer used.`,
      { stage: 'comic:character-reference' }
    )
  }

  let config: CharacterReferenceConfig
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf8')
    config = v.parse(CharacterReferenceSchema, withoutRetiredCharacterFields(JSON.parse(raw), configPath))
  } catch (error) {
    if (v.isValiError(error) || error instanceof SyntaxError) {
      fail(configPath, error.message)
    }
    throw error
  }

  return { config, raw }
}
