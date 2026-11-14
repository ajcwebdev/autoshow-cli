import type { AutoshowConfig, ManagedArtifactToolId, ManagedArtifactValidation, ResolvedYtDlpBinary, RunOptions, RunResult, RuntimeToolId } from '~/types'
export type DoctorStatus = 'OK' | 'MISSING' | 'WARN' | 'INFO'

export type DoctorSeverity = 'warn' | 'info'

export type DoctorCheck = {
  label: string
  status: DoctorStatus
  detail: string
  severity: DoctorSeverity
  nextStep?: string | undefined
}

export type DoctorSection = {
  title: string
  checks: DoctorCheck[]
}

export type DoctorToolProvenance = { healthy: true, detail: string, version?: string } | { healthy: false, reason: string }

export type DoctorProbes = {
  bunVersion: string
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  which: (command: string) => string | undefined
  pathExists: (path: string) => Promise<boolean>
  listDirectory: (path: string) => Promise<string[]>
  directoryHasFiles: (path: string) => Promise<boolean>
  executeReadOnlyTools: boolean
  validateRuntimeTool: (tool: RuntimeToolId, path: string) => Promise<DoctorToolProvenance>
  validateRenderingConfiguration: () => Promise<DoctorToolProvenance>
  validateWhisperfile: (model: string, path: string) => Promise<DoctorToolProvenance>
  validateTesseractData: (prefix: string | undefined) => Promise<DoctorToolProvenance>
  validateAlignmentRuntime: () => Promise<DoctorToolProvenance>
  validateProjectDependencies: () => Promise<DoctorToolProvenance>
  run: (command: string, args: string[], options?: RunOptions) => Promise<RunResult>
  resolveTessdataPrefix: () => string | undefined
  resolveYtDlpBinaryInfo: () => ResolvedYtDlpBinary | undefined
  readDefuddleCliReadiness: () => Promise<DoctorCheck>
  resolveConfigPath: () => Promise<string>
  loadConfig: (path: string) => Promise<AutoshowConfig>
  inspectYtDlpAuthState: () => Promise<Awaited<ReturnType<typeof import('~/cli/commands/command-shared/shared-yt-dlp-options').inspectYtDlpAuthState>>>
  validateManagedArtifact: (tool: ManagedArtifactToolId) => Promise<ManagedArtifactValidation>
}

export type DoctorReport = {
  sections: DoctorSection[]
  hasWarnings: boolean
  missingConfiguredCredentialEnvVars: string[]
  nextSteps: string[]
}
