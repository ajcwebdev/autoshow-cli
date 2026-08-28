import type { SttDiarizationFlagOptions, SttSelectionOptions } from '~/types'

export type SttTargetBuildOptions = SttSelectionOptions & SttDiarizationFlagOptions

export type SttSource = {
  url?: string | undefined
  filePath?: string | undefined
}

export type SttSourceEligibility = {
  supadata: boolean
  scrapecreators: boolean
}
