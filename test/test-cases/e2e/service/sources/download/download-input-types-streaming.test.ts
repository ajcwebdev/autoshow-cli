import { defineSharedDownloadCases, setupDownloadInputTypeLifecycle } from '../../../local/sources/download/download-input-types.shared'

// Public-network acceptance uses the real managed extractor and unchanged
// media/metadata assertions. Select this file explicitly; site access can fail.
export const STREAMING_DOWNLOAD_PROFILE = 'public-live' as const

setupDownloadInputTypeLifecycle([])
defineSharedDownloadCases(['download-youtube', 'download-twitch'])
