import type { FileHandle } from 'node:fs/promises'

export type PaxAttributes = Record<string, string>

export type TarPayloadWrite = (payload: Uint8Array) => Promise<number>

export type ActiveTarEntry = {
  typeFlag: string
  remaining: number
  paddingRemaining: number
  payloadFinished?: boolean | undefined
  handle?: FileHandle | undefined
  mode?: number | undefined
  path?: string | undefined
  metadataChunks?: Buffer[] | undefined
}

export type TarMetadataState = {
  globalPax: PaxAttributes
  nextPax: PaxAttributes
  nextLongPath: string | undefined
  nextLongLink: string | undefined
}
