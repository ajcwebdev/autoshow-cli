import { describe } from 'bun:test'
import {
  registerAmbiguousAdmissionAndOrphanCases,
  registerCompatibleAmbiguousAdmissionCase,
  registerDurableOrphanCases
} from './tts-current-render-recovery/ambiguous-admission-and-orphans.cases'
import {
  registerCheckpointSlotReuseCase,
  registerCompatibleSlotReuseCases
} from './tts-current-render-recovery/compatible-slot-reuse.cases'
import { registerRetryAndPromotionCases } from './tts-current-render-recovery/retry-and-promotion.cases'
import { registerTransitiveLocalCompositionCases } from './tts-current-render-recovery/transitive-local-composition.cases'

describe('TTS completed-render recovery', () => {
  registerRetryAndPromotionCases()
  registerAmbiguousAdmissionAndOrphanCases()
  registerCompatibleSlotReuseCases()
  registerCompatibleAmbiguousAdmissionCase()
  registerCheckpointSlotReuseCase()
  registerDurableOrphanCases()
  registerTransitiveLocalCompositionCases()
})
