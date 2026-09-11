import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  CONTINUITY_BLOCKING_LABEL_SENTENCE,
  CONTINUITY_JUDGE_DOWNSCALE_WIDTH,
  buildContinuityJudgePrompt,
  downscaleImageForContinuityJudge,
  planContinuityJudgeImages,
  prepareContinuityJudgeImages
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/continuity-qa'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupContinuityContractFixtures } from './comic-continuity-contract-fixtures'
const { temporaryDirectories, tinyPng, judgeRequest } = setupContinuityContractFixtures()


describe('continuity judge inputs', () => {
  test('plans the image order with downscaled anchor and predecessor and low-detail absent cards', () => {
    const plan = planContinuityJudgeImages(judgeRequest())
    expect(plan.map(item => [item.role, item.detail])).toEqual([['candidate', 'high'], ['anchor', 'low'], ['cast-card', 'high'], ['absent-card', 'low']])
    expect(plan[1]?.label).toContain('which is also the predecessor')
    const distinct = planContinuityJudgeImages(judgeRequest({ panelNumber: 3, panelPath: '/scene/panels/panel-03.png', predecessorPanel: 2, predecessorPath: '/scene/panels/panel-02.png' }))
    expect(distinct.map(item => item.role)).toEqual(['candidate', 'anchor', 'predecessor', 'cast-card', 'absent-card'])
    const anchorIsCandidate = planContinuityJudgeImages(judgeRequest({ panelNumber: 1, panelPath: '/scene/panels/panel-01.png', predecessorPanel: null, predecessorPath: null }))
    expect(anchorIsCandidate.map(item => item.role)).toEqual(['candidate', 'cast-card', 'absent-card'])
    const laterAnchor = planContinuityJudgeImages(judgeRequest({ panelNumber: 3, panelPath: '/scene/panels/panel-03.png', anchorPanel: 3, anchorPath: '/scene/panels/panel-03.png', predecessorPanel: 2, predecessorPath: '/scene/panels/panel-02.png' }))
    expect(laterAnchor.map(item => item.role)).toEqual(['candidate', 'predecessor', 'cast-card', 'absent-card'])
  })

  test('the judge prompt names the image order, the contract, the roster, and the shared reviewer label class', () => {
    const prompt = buildContinuityJudgePrompt(judgeRequest({ trustedAnchorPanel: 1 }))
    expect(prompt).toContain(CONTINUITY_BLOCKING_LABEL_SENTENCE)
    expect(prompt).toContain('"incorrect character blocking" and "incorrect background characters" for the same defect class')
    expect(prompt).toContain('Image 1: the candidate, panel 2, at full detail.')
    expect(prompt).toContain('Image 2: the anchor, panel 1, the trusted reference for this location, which is also the predecessor (downscaled).')
    expect(prompt).toContain('Image 3: the canonical identity card for characterKey=hero, who is listed in this panel\'s characterKeys.')
    expect(prompt).toContain('Image 4: the canonical identity card for characterKey=rival, who is in the scene roster but absent from this panel\'s characterKeys and must not appear.')
    expect(prompt).toContain('chosen from the human trusted-anchor label 1')
    expect(prompt).toContain('characterKeys, exact and authoritative: hero.')
    expect(prompt).toContain('Scene roster, every character who appears somewhere in this scene: hero, rival.')
    expect(prompt).toContain('Roster characters absent from this panel who must not appear: rival.')
    expect(prompt).toContain('Shot plan: Medium eye-level shot 2; hero is screen left facing right at the control booth.')
    expect(prompt).toContain('cargo-bay: a loading door stays left of a fixed control booth.')
    expect(prompt).toContain('hero: Test hero in a blue uniform | rival: Test rival in a red coat')
    expect(prompt).toContain('Judge screen sides in screen space against the anchor panel.')
    expect(prompt).toContain('Return only the requested JSON.')
    const noPredecessor = buildContinuityJudgePrompt(judgeRequest({ panelNumber: 1, panelPath: '/scene/panels/panel-01.png', predecessorPanel: null, predecessorPath: null }))
    expect(noPredecessor).toContain('The candidate is itself the anchor panel 1')
    expect(noPredecessor).toContain('has no predecessor in its location segment')
    expect(noPredecessor).toContain('No human trusted-anchor label was supplied, so the scene\'s first panel of this location, panel 1, is the anchor by default.')
    const otherLocation = buildContinuityJudgePrompt(judgeRequest({ trustedAnchorPanel: 4 }))
    expect(otherLocation).toContain('The human trusted-anchor label names panel 4, which is in a different location, so the scene\'s first panel of this location, panel 1, is the anchor.')
    expect(otherLocation).not.toContain('location segment')
  })

  test('downscales comparison panels in memory to 768 px wide without enlarging small images', async () => {
    const large = await new Bun.Image(tinyPng).resize(1536, 1024).png().bytes()
    expect((await new Bun.Image(large).metadata()).width).toBe(1536)
    const downscaled = await downscaleImageForContinuityJudge(large)
    expect(downscaled).toMatchObject({ mimeType: 'image/jpeg', width: CONTINUITY_JUDGE_DOWNSCALE_WIDTH, height: 512, sourceWidth: 1536, sourceHeight: 1024 })
    expect(Buffer.from(downscaled.base64, 'base64')).toEqual(Buffer.from(downscaled.bytes))
    const small = await downscaleImageForContinuityJudge(tinyPng)
    expect(small).toMatchObject({ width: 1, height: 1, sourceWidth: 1, sourceHeight: 1 })
  })

  test('prepares judge images from disk with the candidate and cards at native size', async () => {
    const directory = await makeTempDir('autoshow-continuity-images-')
    temporaryDirectories.push(directory)
    const large = await new Bun.Image(tinyPng).resize(1536, 1024).png().bytes()
    const candidate = join(directory, 'panel-02.png')
    const anchor = join(directory, 'panel-01.png')
    const card = join(directory, 'hero.png')
    await Bun.write(candidate, large)
    await Bun.write(anchor, large)
    await Bun.write(card, tinyPng)
    const images = await prepareContinuityJudgeImages(judgeRequest({ panelPath: candidate, anchorPath: anchor, predecessorPath: anchor, castCards: [{ key: 'hero', path: card }], absentCards: [{ key: 'rival', path: card }] }))
    expect(images.map(image => [image.role, image.mimeType, image.width, image.height, image.downscaled, image.detail])).toEqual([
      ['candidate', 'image/png', 1536, 1024, false, 'high'],
      ['anchor', 'image/jpeg', 768, 512, true, 'low'],
      ['cast-card', 'image/png', 1, 1, false, 'high'],
      ['absent-card', 'image/png', 1, 1, false, 'low'],
    ])
    expect(images[0]?.base64).toBe(Buffer.from(large).toString('base64'))
  })
})
