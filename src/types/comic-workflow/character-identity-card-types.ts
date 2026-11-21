export type CharacterIdentityReference = {
  key: string
  name: string
  description: string
  referenceIndex: number
  path: string
}

export type IdentityCardMetadata = {
  schemaVersion: 1
  characterKey: string
  sourceHash: string
  width: 1536
  height: 1024
}
