import { describe,expect,test } from 'bun:test'
import { estimatePageMode,estimatePanelMode,estimateQaWork,normalizeFinalImageEstimateRequest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-estimate'
import { resolveFinalImageOutputPathParts } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-inventory'
import type { FinalImageOutputInventory,FinalImagePageInventory,FinalImagePanelInventory } from '~/types'

describe('price mode contracts', () => {
  test('comic final-image price defaults normalize into discriminated page, panel, and grid requests', () => {
      const base = { scriptPath: 'scene.md', sceneSlug: 'scene' }

      expect(normalizeFinalImageEstimateRequest(base)).toMatchObject({
        mode: 'panel',
        models: ['gpt-image-2'],
        size: '1536x1024',
        quality: 'high',
        force: false,
        selection: 'all',
        selectionSpecified: false,
        variations: ['canonical'],
        variationsSpecified: false,
        qa: { enabled: true, judgeModel: 'gpt-5.6-sol', maxRepairs: 2 }
      })
      expect(normalizeFinalImageEstimateRequest({ ...base, panelsPerImage: 3 })).toMatchObject({
        mode: 'page',
        panelsPerImage: 3
      })
      expect(normalizeFinalImageEstimateRequest({
        ...base,
        panelsPerImage: 1,
        grid: { columns: 2, rows: 3 }
      })).toMatchObject({
        mode: 'grid',
        grid: { columns: 2, rows: 3 }
      })

      const single = normalizeFinalImageEstimateRequest(base)
      expect(resolveFinalImageOutputPathParts(single, 'gpt-image-2', 'canonical')).toEqual({})
      const multipleModels = normalizeFinalImageEstimateRequest({
        ...base,
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image']
      })
      expect(resolveFinalImageOutputPathParts(multipleModels, 'gpt-image-2', 'canonical')).toEqual({
        model: 'gpt-image-2'
      })
      const explicitVariation = normalizeFinalImageEstimateRequest({
        ...base,
        variations: ['canonical']
      })
      expect(resolveFinalImageOutputPathParts(explicitVariation, 'gpt-image-2', 'canonical')).toEqual({
        model: 'gpt-image-2',
        variation: 'canonical'
      })
    })

  test('comic page price estimation preserves per-model skips and reusable QA reports', () => {
      const request = normalizeFinalImageEstimateRequest({
        scriptPath: 'scene.md',
        sceneSlug: 'scene',
        panelsPerImage: 2,
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image'],
        variations: ['canonical', 'cinematic-depth'],
        maxRepairs: 2
      })
      if (request.mode !== 'page') throw new Error('Expected page request')

      const output = (
        model: FinalImageOutputInventory['model'],
        variation: FinalImageOutputInventory['variation'],
        exists: boolean,
        qaReportReusable = false
      ): FinalImageOutputInventory => ({
        model,
        variation,
        outputPath: `${model}/${variation}.png`,
        exists,
        qaReportReusable
      })
      const inventory: FinalImagePageInventory = {
        mode: 'page',
        panelPromptsDir: 'panel-prompts',
        pages: [
          {
            pageNumber: 1,
            panelNumbers: [1, 2],
            referenceCount: 3,
            outputs: [
              output('gpt-image-2', 'canonical', true, true),
              output('gpt-image-2', 'cinematic-depth', false),
              output('gemini-3.1-flash-lite-image', 'canonical', false),
              output('gemini-3.1-flash-lite-image', 'cinematic-depth', false)
            ]
          },
          {
            pageNumber: 2,
            panelNumbers: [3, 4],
            referenceCount: 2,
            outputs: [
              output('gpt-image-2', 'canonical', false),
              output('gpt-image-2', 'cinematic-depth', false),
              output('gemini-3.1-flash-lite-image', 'canonical', false),
              output('gemini-3.1-flash-lite-image', 'cinematic-depth', false)
            ]
          }
        ]
      }

      const estimate = estimatePageMode(request, inventory)
      expect(estimate).toEqual({
        mode: 'page',
        totalOutputs: 7,
        skipped: 1,
        outputsByModel: [
          { model: 'gpt-image-2', outputs: 3 },
          { model: 'gemini-3.1-flash-lite-image', outputs: 4 }
        ]
      })
      expect(estimateQaWork(request, estimate, inventory)).toMatchObject({
        mode: 'page',
        initialJudgeCalls: 7,
        reusedReports: 1,
        maximumAdditionalImageEdits: 14,
        maximumAdditionalJudgeCalls: 14,
        estimatedInputTokens: 35_000,
        estimatedOutputTokens: 8_400
      })

      const forcedRequest = { ...request, force: true }
      const forcedEstimate = estimatePageMode(forcedRequest, inventory)
      expect(forcedEstimate).toMatchObject({ totalOutputs: 8, skipped: 0 })
      expect(estimateQaWork(forcedRequest, forcedEstimate, inventory)).toMatchObject({
        initialJudgeCalls: 8,
        reusedReports: 0
      })
    })

  test('comic panel and grid price estimation preserves grouped skips and local composite counts', () => {
      const request = normalizeFinalImageEstimateRequest({
        scriptPath: 'scene.md',
        sceneSlug: 'scene',
        panelsPerImage: 1,
        grid: { columns: 2, rows: 3 },
        imageModels: ['gpt-image-2', 'gemini-3.1-flash-lite-image'],
        variations: ['canonical', 'animation-polish'],
        maxRepairs: 2
      })
      if (request.mode !== 'grid') throw new Error('Expected grid request')

      const inventory: FinalImagePanelInventory = {
        mode: 'grid',
        panelPromptsDir: 'panel-prompts',
        panels: [
          {
            directoryName: 'panel-01',
            panelNumber: 1,
            referenceCount: 2,
            variations: [
              { variation: 'canonical', allModelsExist: true },
              { variation: 'animation-polish', allModelsExist: false }
            ]
          },
          {
            directoryName: 'panel-02',
            panelNumber: 2,
            referenceCount: 2,
            variations: [
              { variation: 'canonical', allModelsExist: false },
              { variation: 'animation-polish', allModelsExist: true }
            ]
          }
        ],
        gridPages: [{
          pageNumber: 1,
          panelNumbers: [1, 2],
          outputs: [
            { model: 'gpt-image-2', variation: 'canonical', outputPath: 'a', exists: true, qaReportReusable: false },
            { model: 'gpt-image-2', variation: 'animation-polish', outputPath: 'b', exists: false, qaReportReusable: false },
            { model: 'gemini-3.1-flash-lite-image', variation: 'canonical', outputPath: 'c', exists: true, qaReportReusable: false },
            { model: 'gemini-3.1-flash-lite-image', variation: 'animation-polish', outputPath: 'd', exists: false, qaReportReusable: false }
          ]
        }]
      }

      const estimate = estimatePanelMode(request, inventory)
      expect(estimate).toEqual({
        mode: 'grid',
        totalOutputs: 2,
        skipped: 2,
        grid: {
          totalOutputs: 2,
          skipped: 2,
          columns: 2,
          rows: 3,
          capacity: 6
        }
      })
      expect(estimateQaWork(request, estimate, inventory)).toMatchObject({
        mode: 'panel',
        initialJudgeCalls: 2,
        maximumAdditionalImageEdits: 4,
        maximumAdditionalJudgeCalls: 4,
        maximumTotalJudgeCalls: 6,
        estimatedInputTokens: 30_000,
        estimatedOutputTokens: 7_200
      })

      const forcedEstimate = estimatePanelMode({ ...request, force: true }, inventory)
      expect(forcedEstimate).toMatchObject({
        totalOutputs: 4,
        skipped: 0,
        grid: { totalOutputs: 4, skipped: 0 }
      })
    })
})
