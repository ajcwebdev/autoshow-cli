import type { SttDiarizationFlagOptions, SttSelectionOptions } from '~/types'

export type SttEstimateOptions = SttSelectionOptions & SttDiarizationFlagOptions & {
  youtubeCaptions?: boolean | undefined
  happyscribeOrganizationId?: string | undefined
}
