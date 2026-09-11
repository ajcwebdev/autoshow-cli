import { existsSync, readFileSync } from 'node:fs'
import * as v from 'valibot'
import type { CharacterReferenceConfig } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { CharacterReferenceSchema } from '../schemas/schemas'

import { fail } from './character-catalog-validation'

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
    config = v.parse(CharacterReferenceSchema, JSON.parse(raw))
  } catch (error) {
    if (v.isValiError(error) || error instanceof SyntaxError) {
      fail(configPath, error.message)
    }
    throw error
  }

  return { config, raw }
}
