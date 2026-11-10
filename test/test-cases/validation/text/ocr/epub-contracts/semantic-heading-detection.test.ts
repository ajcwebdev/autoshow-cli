import { describe, expect, test } from 'bun:test'
import {
  extractSemanticHeadingTitle,
  findHeadingCandidates
} from '~/cli/commands/text/ocr/ebook/epub/heading-detection'

describe('EPUB semantic heading detection contracts', () => {
  test('formats chapter, appendix, about-author, named, and backmatter headings', () => {
    expect(extractSemanticHeadingTitle('chapter iv: the   storm')).toBe('Chapter IV: the storm')
    expect(extractSemanticHeadingTitle('Chatper 12')).toBe('Chapter 12')
    expect(extractSemanticHeadingTitle('CHAPTER one - Arrival')).toBe('Chapter one: Arrival')
    expect(extractSemanticHeadingTitle('appendix b. Tables')).toBe('Appendix B: Tables')
    expect(extractSemanticHeadingTitle('Appendix 3')).toBe('Appendix 3')
    expect(extractSemanticHeadingTitle('about author')).toBe('About the Author')
    expect(extractSemanticHeadingTitle('About the Author: Jane Roe')).toBe('About the Author: Jane Roe')
    expect(extractSemanticHeadingTitle('Introduction')).toBe('Introduction')
    expect(extractSemanticHeadingTitle('PROLOGUE: Before')).toBe('PROLOGUE: Before')
    expect(extractSemanticHeadingTitle('Select Bibliography')).toBe('Select Bibliography')
    expect(extractSemanticHeadingTitle('notes; part two')).toBe('notes: part two')
  })

  test('accepts numbered book headings and rejects dates, list paragraphs, and known page headers', () => {
    expect(extractSemanticHeadingTitle('7 "The Long Road"')).toBe('7 The Long Road')
    expect(extractSemanticHeadingTitle('7 "The Long Road".')).toBe('7 The Long Road')
    expect(extractSemanticHeadingTitle('7 “The Long Road”.')).toBe('7 The Long Road')
    expect(extractSemanticHeadingTitle('7 “The Long Road.”')).toBe('7 The Long Road')
    expect(extractSemanticHeadingTitle('12 March 1999')).toBeUndefined()
    expect(extractSemanticHeadingTitle('3 Battles of 1066')).toBeUndefined()
    expect(extractSemanticHeadingTitle('250 The Long Road')).toBeUndefined()
    expect(extractSemanticHeadingTitle('4 the lower case start')).toBeUndefined()
    expect(extractSemanticHeadingTitle('4 This one ends like a sentence.')).toBe('4 This one ends like a sentence')
    expect(extractSemanticHeadingTitle('4 This one ends like a question?')).toBeUndefined()
    expect(extractSemanticHeadingTitle('4 This has, a comma inside')).toBeUndefined()
    expect(extractSemanticHeadingTitle('4 Figure Captions')).toBeUndefined()
    expect(extractSemanticHeadingTitle('42 The Long Road', { titleLikeKeys: new Set(['the long road']) })).toBeUndefined()
    expect(extractSemanticHeadingTitle('19 The Long Road', { titleLikeKeys: new Set(['the long road']) })).toBe('19 The Long Road')
  })

  test('rejects empty, overlong, and unrelated lines', () => {
    expect(extractSemanticHeadingTitle('   ')).toBeUndefined()
    expect(extractSemanticHeadingTitle(`Chapter 1: ${'x'.repeat(140)}`)).toBeUndefined()
    expect(extractSemanticHeadingTitle('An ordinary sentence of prose.')).toBeUndefined()
  })

  test('heading candidates carry the semantic kind', () => {
    const text = ['Appendix A: Data', 'body', 'Epilogue', 'body', 'About the Author', 'body', 'Index', 'body', '9 Final Steps', 'body'].join('\n')
    expect(findHeadingCandidates(text).map(candidate => [candidate.title, candidate.kind])).toEqual([
      ['Appendix A: Data', 'appendix'],
      ['Epilogue', 'named'],
      ['About the Author', 'about-author'],
      ['Index', 'backmatter'],
      ['9 Final Steps', 'numbered']
    ])
  })
})
