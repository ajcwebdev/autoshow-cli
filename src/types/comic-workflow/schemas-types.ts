import type * as v from 'valibot'

// Character reference images are addressed relative to the configured characters
// root, so the path is an ordinary string rather than a fixed literal union.
export type CharacterFilePath = string

export type CharacterReferenceConfig =
  v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/schemas/schemas').CharacterReferenceSchema>

declare const characterKeyBrand: unique symbol
export type CharacterKey = string & { readonly [characterKeyBrand]?: true }

export type CharacterCatalogEntry = CharacterReferenceConfig['characters'][number] & {
  key: CharacterKey
  sourcePath: string
  outlineSheetPath: string
}

export type CharacterCatalogService = Readonly<{
  schemaVersion: 3
  root: string
  configPath: string
  hash: string
  characters: readonly CharacterCatalogEntry[]
  characterKeys: readonly CharacterKey[]
  get: (key: CharacterKey) => CharacterCatalogEntry
  resolve: (value: string) => readonly CharacterKey[] | undefined
  requireKey: (value: string) => CharacterKey
  detectMentions: (text: string) => Array<{ raw: string; characterKeys: CharacterKey[] }>
  detect: (text: string) => CharacterKey[]
}>
