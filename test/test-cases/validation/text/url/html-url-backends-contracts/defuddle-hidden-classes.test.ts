import { expect, test } from 'bun:test'
import { stripNonHidingHiddenClasses } from '~/cli/commands/text/url/url-local/defuddle/run-defuddle-url'
import { configureBinDir } from '~/utils/runtime-paths'
import { writeFakeDefuddleBinIn } from '../../../../../test-utils/fixtures/fake-defuddle-bin'
import { extractHtmlToMarkdown, longMarkdown, makeTempDir } from './shared'

test('pseudo-element hidden variants are stripped so inline code stays visible to Defuddle', () => {
  const html = '<td><code class="relative mx-1 font-mono after:hidden before:hidden inline-flex px-1">pcm</code></td>'

  expect(stripNonHidingHiddenClasses(html)).toBe(
    '<td><code class="relative mx-1 font-mono inline-flex px-1">pcm</code></td>'
  )
})

test('stacked and single-quoted pseudo-element variants are stripped', () => {
  expect(stripNonHidingHiddenClasses("<span class='md:before:hidden placeholder:invisible text-sm'>x</span>"))
    .toBe("<span class='text-sm'>x</span>")
})

test('light-theme copy of a themed pair is kept while its dark twin stays hidden', () => {
  const html = '<div class="relative hidden dark:block"><pre>dark</pre></div><div class="relative dark:hidden"><pre>light</pre></div>'

  expect(stripNonHidingHiddenClasses(html)).toBe(
    '<div class="relative hidden dark:block"><pre>dark</pre></div><div class="relative"><pre>light</pre></div>'
  )
})

test('collapsed accordion body revealed on state=open is un-hidden', () => {
  const html = '<div class="group-data-[state=open]/collapsible:block hidden" data-type="section-content"><h5>voice_id</h5></div>'

  expect(stripNonHidingHiddenClasses(html)).toBe(
    '<div class="group-data-[state=open]/collapsible:block" data-type="section-content"><h5>voice_id</h5></div>'
  )
  expect(stripNonHidingHiddenClasses('<div class="invisible data-[state=open]:visible">x</div>'))
    .toBe('<div class="data-[state=open]:visible">x</div>')
})

test('hidden stays when the state variant is not open or does not reveal the element', () => {
  const html = [
    '<div class="group-data-[state=on]:block hidden"></div>',
    '<div class="data-[state=active]:block hidden">tab</div>',
    '<div class="data-[state=open]:rotate-180 hidden">icon</div>',
    '<div class="data-[state=open]:hidden">closed label</div>'
  ].join('')

  expect(stripNonHidingHiddenClasses(html)).toBe(html)
})

test('classes that really hide the element are left for Defuddle to remove', () => {
  const html = [
    '<div class="hidden">a</div>',
    '<div class="invisible">b</div>',
    '<div class="md:hidden">c</div>',
    '<div class="print:hidden lg:invisible">d</div>',
    '<div class="[&>svg]:hidden">e</div>',
    '<p>before:hidden in prose is not a class attribute</p>'
  ].join('')

  expect(stripNonHidingHiddenClasses(html)).toBe(html)
})

test('extractHtmlToMarkdown hands Defuddle the sanitized HTML', async () => {
  const dir = await makeTempDir('autoshow-fake-defuddle-hidden-')
  await writeFakeDefuddleBinIn(dir, [
    "const html = readFileSync(args[1] ?? '', 'utf8')",
    "const classes = [...html.matchAll(/class=\"([^\"]*)\"/g)].map((match) => match[1]).join('|')",
    `console.log(JSON.stringify({ contentMarkdown: ${JSON.stringify(`${longMarkdown} classes=`)} + classes }))`
  ], ["import { readFileSync } from 'node:fs'"])
  configureBinDir(dir)

  const result = await extractHtmlToMarkdown({
    html: '<!doctype html><html><body><article><code class="font-mono after:hidden before:hidden">mp3</code><div class="md:hidden">nav</div></article></body></html>',
    documentUrl: 'https://example.test/docs'
  })

  expect(result.markdown).toContain('classes=font-mono|md:hidden')
})
