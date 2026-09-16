import type {
  GenerationModality,
  ImageProvider,
  MusicProvider,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  VideoProvider
} from '~/types'

/** Everything a provider adapter needs from the scaffold to build a request and place its artifacts. */
export type MediaGenerationContext = {
  readonly apiKey: string
  readonly outputDir: string
  readonly model: string
  /** Canonical in-workspace artifact path; the shared target runner renames these per service afterwards. */
  readonly artifactPath: (extension?: string | undefined, index?: number | undefined) => string
  readonly logStatus: (status: string, detail?: string | undefined) => void
}

export type MediaGenerationOutcome<TMetadata> = {
  readonly artifactPaths: readonly string[]
  readonly metadata: TMetadata
  readonly completionDetail?: string | undefined
}

/**
 * One generation run. `prepare` builds the request and runs before the clock starts, matching where
 * the hand-written adapters placed `startTime`; `execute` is the billed provider call plus response parse.
 */
export type MediaGenerationDescriptor<TPrepared, TMetadata> = {
  readonly modality: GenerationModality
  readonly service: string
  readonly model: string
  readonly outputDir: string
  readonly startDetail?: string | ((prepared: TPrepared) => string | undefined) | undefined
  /** `'none'` is for providers whose shared client factory owns the credential. */
  readonly credential?: 'registry' | 'none' | undefined
  readonly prepare: (context: MediaGenerationContext) => Promise<TPrepared> | TPrepared
  readonly estimate?: ((prepared: TPrepared) => void) | undefined
  readonly execute: (context: MediaGenerationContext, prepared: TPrepared) => Promise<MediaGenerationOutcome<TMetadata>>
}

export type MediaGenerationRun<TMetadata> = {
  readonly artifactPaths: string[]
  readonly fileNames: string[]
  readonly primaryPath: string
  readonly primaryFileSize: number
  readonly processingTime: number
  readonly metadata: TMetadata
}

/** The metadata fields the scaffold cannot derive; the identity, timing and file facts are stamped for every provider. */
export type ImageGenerationMetadata = Omit<
  Step5Metadata,
  'imageService' | 'imageModel' | 'processingTime' | 'imageFileNames' | 'imageCount' | 'imageFileSize'
>

export type VideoGenerationMetadata = Omit<
  Step6VideoMetadata,
  'videoGenService' | 'videoGenModel' | 'processingTime' | 'videoFileName' | 'videoFileSize'
>

export type MusicGenerationMetadata = Omit<
  Step7MusicMetadata,
  'musicService' | 'musicModel' | 'processingTime' | 'musicFileName' | 'musicFileSize'
>

type ModalityDescriptor<TService extends string, TPrepared, TMetadata> =
  Omit<MediaGenerationDescriptor<TPrepared, TMetadata>, 'modality' | 'service'> & { readonly service: TService }

export type ImageGenerationDescriptor<TPrepared> = ModalityDescriptor<ImageProvider, TPrepared, ImageGenerationMetadata>
export type VideoGenerationDescriptor<TPrepared> = ModalityDescriptor<VideoProvider, TPrepared, VideoGenerationMetadata>
export type MusicGenerationDescriptor<TPrepared> = ModalityDescriptor<MusicProvider, TPrepared, MusicGenerationMetadata>
