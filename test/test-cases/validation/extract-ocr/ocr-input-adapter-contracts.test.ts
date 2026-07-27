import { describe, expect, test } from 'bun:test'
import {
  hasPreparedMarkdownInput,
  resolveOcrInputAdapter
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-input-adapters'

describe('OCR input adapter contracts', () => {
  test('prepared markdown is classified as HTML/article input before file format', () => {
    expect(hasPreparedMarkdownInput({ preparedMarkdown: ' # title ' })).toBe(true)
    expect(resolveOcrInputAdapter('pdf', { preparedMarkdown: 'content' }).family).toBe('html')
  })

  test('document formats map to stable OCR input families', () => {
    expect(resolveOcrInputAdapter('epub', {}).family).toBe('epub')
    expect(resolveOcrInputAdapter('docx', {}).family).toBe('office')
    expect(resolveOcrInputAdapter('rtf', {}).family).toBe('rtf')
    expect(resolveOcrInputAdapter('csv', {}).family).toBe('csv')
    expect(resolveOcrInputAdapter('cbz', {}).family).toBe('cbz')
    expect(resolveOcrInputAdapter('png', {}).family).toBe('image')
    expect(resolveOcrInputAdapter('pdf', {}).family).toBe('pdf')
  })
})
