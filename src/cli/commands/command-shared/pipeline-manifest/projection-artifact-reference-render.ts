import type { RenderCollectorContext } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { ArtifactReferenceSink } from './projection-artifact-reference-sink'
import { collectAdmissionJournal, collectReadinessAuthorization } from './projection-artifact-reference-admission'
import { collectAudioRun, collectConsumedSelectionRebuild, collectGenericEventLists, collectProviderRenderResult } from './projection-artifact-reference-audio'
import { collectBatchProgress } from './projection-artifact-reference-batch'

const collectRenderEvent = (event: Record<string, unknown>, ctx: RenderCollectorContext): boolean => (
  collectAdmissionJournal(event, ctx)
  && collectProviderRenderResult(event, ctx)
  && collectAudioRun(event, ctx)
  && collectReadinessAuthorization(event, ctx)
  && collectGenericEventLists(event, ctx)
  && collectConsumedSelectionRebuild(event, ctx)
  && collectBatchProgress(event, ctx)
)

type ReportedOutputAuthority = { renderIdentity: string, eventSequence: number }

const collectRenderRecord = (rawRender: unknown, targetKey: string, sink: ArtifactReferenceSink, reportedOutputAuthority?: ReportedOutputAuthority | undefined): boolean => {
  if (!isRecord(rawRender)) return false
  const renderPlanId = rawRender['renderPlanId']
  const renderIdentity = rawRender['renderIdentity']
  const renderDir = rawRender['renderDir']
  const events = rawRender['events']
  if (typeof renderPlanId !== 'string' || typeof renderIdentity !== 'string' || !Array.isArray(events)) return false
  if (!sink.addFile(rawRender, {
    pathKey: 'renderPlanRef',
    shaKey: 'renderPlanSha256',
    kind: 'render-plan',
    expectedJsonFields: { renderPlanId, renderIdentity, targetKey },
    context: { renderDir: renderDir as string }
  })) return false
  if (!sink.addDirectory(renderDir)) return false
  return events.every((event) => isRecord(event) && collectRenderEvent(event, {
    targetKey,
    render: rawRender,
    renderPlanId,
    renderIdentity,
    renderDir: renderDir as string,
    verifyReportedOutputs: reportedOutputAuthority?.renderIdentity === renderIdentity && reportedOutputAuthority.eventSequence === event['sequence'],
    sink,
  }))
}

export const collectRenderHistory = (
  renders: readonly unknown[],
  targetKey: string,
  sink: ArtifactReferenceSink,
  reportedOutputAuthority?: ReportedOutputAuthority | undefined
): boolean => renders.every((render) => collectRenderRecord(render, targetKey, sink, reportedOutputAuthority))
