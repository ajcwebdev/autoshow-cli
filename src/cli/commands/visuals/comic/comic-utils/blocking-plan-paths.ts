import { join } from 'node:path'
import { getSceneMetadataDirectoryForWorkspace, getSceneOutputDirectory } from './project-paths'

export const BLOCKING_PLAN_FILENAME = 'blocking-plan.json'
export const BLOCKING_PLAN_INVALID_FILENAME = 'blocking-plan.invalid.json'
export const BLOCKING_BINDINGS_FILENAME = 'blocking-bindings.json'
export const BLOCKING_PROMPT_FILENAME = 'blocking-prompt.md'
export const BLOCKING_DIRECTORY_NAME = 'blocking'
export const BLOCKING_LEDGER_FILENAME = 'blocking-ledger.md'
export const BLOCKING_PLAN_OVERVIEW_SVG_FILENAME = 'plan-overview.svg'

const metadataDirectory = (sceneSlug: string): string => getSceneMetadataDirectoryForWorkspace(getSceneOutputDirectory(sceneSlug))

export const getBlockingPlanPath = (sceneSlug: string): string => join(metadataDirectory(sceneSlug), BLOCKING_PLAN_FILENAME)
export const getInvalidBlockingPlanPath = (sceneSlug: string): string => join(metadataDirectory(sceneSlug), BLOCKING_PLAN_INVALID_FILENAME)
export const getBlockingBindingsPath = (sceneSlug: string): string => join(metadataDirectory(sceneSlug), BLOCKING_BINDINGS_FILENAME)
export const getBlockingPromptPath = (sceneSlug: string): string => join(metadataDirectory(sceneSlug), BLOCKING_PROMPT_FILENAME)
export const getBlockingDirectory = (sceneSlug: string): string => join(metadataDirectory(sceneSlug), BLOCKING_DIRECTORY_NAME)
export const getBlockingLedgerPath = (sceneSlug: string): string => join(getBlockingDirectory(sceneSlug), BLOCKING_LEDGER_FILENAME)
export const getBlockingPlanOverviewSvgPath = (sceneSlug: string): string => join(getBlockingDirectory(sceneSlug), BLOCKING_PLAN_OVERVIEW_SVG_FILENAME)
export const getBlockingPanelSvgFilename = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}.svg`
export const getBlockingPanelSvgPath = (sceneSlug: string, panelNumber: number): string => join(getBlockingDirectory(sceneSlug), getBlockingPanelSvgFilename(panelNumber))
export const getBlockingPanelLayoutGuideFilename = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}-layout.png`
export const getBlockingPanelLayoutGuidePath = (sceneSlug: string, panelNumber: number): string => join(getBlockingDirectory(sceneSlug), getBlockingPanelLayoutGuideFilename(panelNumber))

export const getBlockingDirectoryForWorkspace = (sceneDirectory: string): string => join(getSceneMetadataDirectoryForWorkspace(sceneDirectory), BLOCKING_DIRECTORY_NAME)
export const getBlockingPlanPathForWorkspace = (sceneDirectory: string): string => join(getSceneMetadataDirectoryForWorkspace(sceneDirectory), BLOCKING_PLAN_FILENAME)
export const getBlockingBindingsPathForWorkspace = (sceneDirectory: string): string => join(getSceneMetadataDirectoryForWorkspace(sceneDirectory), BLOCKING_BINDINGS_FILENAME)
