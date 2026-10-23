import assemblyLinks from './model-links/assembly.json'
import claudeLinks from './model-links/claude.json'
import cloudflareLinks from './model-links/cloudflare.json'
import deepgramLinks from './model-links/deepgram.json'
import deepinfraLinks from './model-links/deepinfra.json'
import elevenlabsLinks from './model-links/elevenlabs.json'
import falLinks from './model-links/fal.json'
import geminiLinks from './model-links/gemini.json'
import gladiaLinks from './model-links/gladia.json'
import grokLinks from './model-links/grok.json'
import inworldLinks from './model-links/inworld.json'
import whisperfileLinks from './model-links/whisperfile.json'
import minimaxLinks from './model-links/minimax.json'
import mistralLinks from './model-links/mistral.json'
import openaiLinks from './model-links/openai.json'
import scrapecreatorsLinks from './model-links/scrapecreators.json'
import sonioxLinks from './model-links/soniox.json'
import spiderLinks from './model-links/spider.json'
import speechmaticsLinks from './model-links/speechmatics.json'
import togetherLinks from './model-links/together.json'
import xLinks from './model-links/x-links.json'
import zyteLinks from './model-links/zyte.json'
import type { ModelLinksData } from '~/types'

const providerLinks = [
  elevenlabsLinks,
  togetherLinks,
  openaiLinks,
  geminiLinks,
  gladiaLinks,
  grokLinks,
  xLinks,
  whisperfileLinks,
  mistralLinks,
  minimaxLinks,
  claudeLinks,
  assemblyLinks,
  deepgramLinks,
  deepinfraLinks,
  cloudflareLinks,
  sonioxLinks,
  speechmaticsLinks,
  inworldLinks,
  scrapecreatorsLinks,
  zyteLinks,
  falLinks,
  spiderLinks
] as const satisfies readonly ModelLinksData[]

const modelLinks = Object.assign({}, ...providerLinks) satisfies ModelLinksData

export default modelLinks
