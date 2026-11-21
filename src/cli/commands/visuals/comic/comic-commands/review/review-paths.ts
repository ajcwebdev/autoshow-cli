import { join } from 'node:path'
import { getSceneMetadataDirectoryForWorkspace, getSceneOutputDirectory } from '../../comic-utils/project-paths'

export const REVIEW_DIRECTORY_NAME = 'review'

export const getReviewDirectory = (sceneSlug: string): string =>
  join(getSceneMetadataDirectoryForWorkspace(getSceneOutputDirectory(sceneSlug)), REVIEW_DIRECTORY_NAME)

export const REVIEW_SHEET_FILENAME = 'review-sheet.html'
export const REVIEW_EXPORT_DOC_FILENAME = 'export-doc.md'

export const getReviewSheetPath = (sceneSlug: string): string =>
  join(getReviewDirectory(sceneSlug), REVIEW_SHEET_FILENAME)

export const getReviewExportDocPath = (sceneSlug: string): string =>
  join(getReviewDirectory(sceneSlug), REVIEW_EXPORT_DOC_FILENAME)
