import { registerComicAndVoiceHelpCases } from './cli-help-contracts/comic-and-voice-help.cases'
import { registerGlobalFlagAndRegistryCases } from './cli-help-contracts/global-flag-and-registry.cases'
import { registerMediaCommandHelpCases } from './cli-help-contracts/media-command-help.cases'
import { registerPipelineCommandHelpCases } from './cli-help-contracts/pipeline-command-help.cases'
import { registerRootRenderingCases } from './cli-help-contracts/root-rendering.cases'

registerRootRenderingCases()
registerPipelineCommandHelpCases()
registerMediaCommandHelpCases()
registerComicAndVoiceHelpCases()
registerGlobalFlagAndRegistryCases()
