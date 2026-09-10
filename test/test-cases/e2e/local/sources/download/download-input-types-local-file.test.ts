import { defineSharedDownloadCases, setupDownloadInputTypeLifecycle } from './download-input-types.shared'

setupDownloadInputTypeLifecycle(['1-audio', '1-document'])
defineSharedDownloadCases(['download-local-audio', 'download-local-document'])
