import { join } from 'node:path'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { createProtectedVoiceAssetStore } from '../voice-assets/protected-voice-asset-store'

export const MANAGED_VOICE_STORE_ID = 'managed_voice_assets_v1'
export const MANAGED_VOICE_STORE_ROOT = join(RUNTIME_DIR, 'protected-voice-assets', 'managed-v1')

export const managedVoiceAssetStore = createProtectedVoiceAssetStore({
  storeId: MANAGED_VOICE_STORE_ID,
  root: MANAGED_VOICE_STORE_ROOT
})
