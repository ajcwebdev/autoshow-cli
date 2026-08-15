import assemblyLinks from './model-links/assembly.json'
import betterAuthLinks from './model-links/better-auth.json'
import bflLinks from './model-links/bfl.json'
import cartesiaLinks from './model-links/cartesia.json'
import cerebrasLinks from './model-links/cerebras.json'
import claudeLinks from './model-links/claude.json'
import deapiLinks from './model-links/deapi.json'
import deepgramLinks from './model-links/deepgram.json'
import deepinfraLinks from './model-links/deepinfra.json'
import driveLinks from './model-links/drive.json'
import elevenlabsLinks from './model-links/elevenlabs.json'
import firecrawlLinks from './model-links/firecrawl.json'
import fishLinks from './model-links/fish.json'
import falLinks from './model-links/fal.json'
import geminiLinks from './model-links/gemini.json'
import gladiaLinks from './model-links/gladia.json'
import glmLinks from './model-links/glm.json'
import grokLinks from './model-links/grok.json'
import groqLinks from './model-links/groq.json'
import happyscribeLinks from './model-links/happyscribe.json'
import humeLinks from './model-links/hume.json'
import inworldLinks from './model-links/inworld.json'
import kimiLinks from './model-links/kimi.json'
import whisperfileLinks from './model-links/whisperfile.json'
import ltxLinks from './model-links/ltx.json'
import lumalabsLinks from './model-links/lumalabs.json'
import minimaxLinks from './model-links/minimax.json'
import mistralLinks from './model-links/mistral.json'
import openaiLinks from './model-links/openai.json'
import recraftLinks from './model-links/recraft.json'
import replicateLinks from './model-links/replicate.json'
import resendLinks from './model-links/resend.json'
import revLinks from './model-links/rev.json'
import runwayLinks from './model-links/runway.json'
import scrapecreatorsLinks from './model-links/scrapecreators.json'
import sonioxLinks from './model-links/soniox.json'
import solidbaseLinks from './model-links/solidbase.json'
import spiderLinks from './model-links/spider.json'
import speechifyLinks from './model-links/speechify.json'
import speechmaticsLinks from './model-links/speechmatics.json'
import supadataLinks from './model-links/supadata.json'
import togetherLinks from './model-links/together.json'
import xLinks from './model-links/x-links.json'
import zyteLinks from './model-links/zyte.json'
import type { ModelLinksData } from '~/types'

const providerLinks = [
  elevenlabsLinks,
  groqLinks,
  togetherLinks,
  driveLinks,
  openaiLinks,
  geminiLinks,
  gladiaLinks,
  glmLinks,
  grokLinks,
  xLinks,
  kimiLinks,
  whisperfileLinks,
  ltxLinks,
  lumalabsLinks,
  mistralLinks,
  minimaxLinks,
  claudeLinks,
  assemblyLinks,
  betterAuthLinks,
  bflLinks,
  cartesiaLinks,
  cerebrasLinks,
  deapiLinks,
  deepgramLinks,
  deepinfraLinks,
  sonioxLinks,
  solidbaseLinks,
  speechmaticsLinks,
  speechifyLinks,
  revLinks,
  recraftLinks,
  replicateLinks,
  runwayLinks,
  resendLinks,
  happyscribeLinks,
  humeLinks,
  inworldLinks,
  supadataLinks,
  scrapecreatorsLinks,
  zyteLinks,
  firecrawlLinks,
  fishLinks,
  falLinks,
  spiderLinks
] as const satisfies readonly ModelLinksData[]

const modelLinks = Object.assign({}, ...providerLinks) satisfies ModelLinksData

export default modelLinks
