import type { BunImageEncoder, BunImageSource } from '~/types'

type BunImagePngEncoder = BunImageEncoder & {
  png: () => BunImagePngEncoder
}

export type BunImageEncoderConstructor = new (source: BunImageSource) => BunImagePngEncoder
