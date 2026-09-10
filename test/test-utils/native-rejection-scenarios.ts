import { test } from 'bun:test'
import { assertRejection, rejectionScenarios } from '../scenarios/local-cli-contracts'
import { STABLE_TTS_MD_PATH } from './test-helpers'
import { createNativeScenarioAdapter } from './native-scenario-adapter'

export function defineNativeRejections(source: string): void {
  const fixtures: Record<string, string> = {
    text: STABLE_TTS_MD_PATH, dialogue: 'input/examples/tts/tts-dialogue.txt', audio: 'input/examples/audio/anthony-voice.mp3'
  }
  const adapter = createNativeScenarioAdapter(fixtures, { env: { MISTRAL_API_KEY: '' } })
  const scenarios = rejectionScenarios(adapter.fixture).filter(scenario => scenario.source === source)
  if (scenarios.length === 0) throw new Error(`No native rejection scenarios for ${source}`)
  for (const scenario of scenarios) {
    test(scenario.name, async () => {
      const result = await adapter.execute(scenario.args)
      assertRejection(result, scenario)
    })
  }
}
