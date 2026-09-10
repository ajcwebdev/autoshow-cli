import { defineSharedDownloadCases, setupDownloadInputTypeLifecycle } from './download-input-types.shared'

setupDownloadInputTypeLifecycle(['1-audio', '2-video'])
defineSharedDownloadCases(['download-direct-audio', 'download-direct-video', 'download-url-list'])
