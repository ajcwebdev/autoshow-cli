import { openZip, readZipEntryData } from '~/cli/commands/sources/download/document/zip-xml-utils'
import { ValidationError } from '~/utils/error-handler'
import type { DocxBlockState } from './docx-block-emission'
import { emitDocxBodyBlock, flushDocxFrontTitle } from './docx-block-emission'
import { contentChildren, parseDocxBody } from './docx-body-reader'

export async function readDocxMarkdown(inputPath: string): Promise<string> {
  const { buf, entries } = await openZip(inputPath);
  const entry = entries.get('word/document.xml');
  if (!entry) throw ValidationError('Could not read word/document.xml', { stage: 'extract:docx-markdown' });
  return documentXmlToMarkdown(readZipEntryData(buf, entry).toString('utf8'), inputPath);
}

export function documentXmlToMarkdown(xml: string, inputPath = "word/document.xml"): string {
  const body = parseDocxBody(xml, inputPath);
  const state: DocxBlockState = { lines: [], frontTitle: [], frontMatter: true };
  for (const node of contentChildren(body)) emitDocxBodyBlock(state, node);
  flushDocxFrontTitle(state);
  return state.lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s*$/, "\n");
}
