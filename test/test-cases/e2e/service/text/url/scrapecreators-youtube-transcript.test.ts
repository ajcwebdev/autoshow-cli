import { defineUrlTranscriptServiceTest } from './define-url-transcript-service-test'

const budgetKey = 'transcribe-scrapecreators-youtube-transcript'
void budgetKey

defineUrlTranscriptServiceTest({
  service: 'scrapecreators',
  model: 'youtube-transcript',
  provider: 'scrapecreators',
  envVarKey: 'SCRAPECREATORS_API_KEY',
  envVarDescription: 'ScrapeCreators YouTube transcript retrieval',
})
