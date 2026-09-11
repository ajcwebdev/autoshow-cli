import type { Step1Metadata } from '~/types'

export const buildHostedStep1 = (overrides: Partial<Step1Metadata> = {}): Step1Metadata => ({
  title: 'Hosted audio',
  duration: 'Unknown',
  channel: 'Unknown',
  description: '',
  url: 'https://example.com/audio.mp3',
  slug: 'hosted-audio',
  audioFileName: 'audio.mp3',
  audioFileSize: 1234,
  ...overrides
})
