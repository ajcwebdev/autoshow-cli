import { describe, expect, test } from "bun:test";

import { documentXmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/office/docx-markdown';

function wordDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<word:document xmlns:word="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:alt="urn:alternate-word-prefix">
  <word:body>${body}</word:body>
</word:document>`;
}

describe("documentXmlToMarkdown", () => {
  test("preserves namespace-prefixed mixed content, entities, emphasis, tabs, and breaks", () => {
    const xml = wordDocument(`
      <word:p>
        <word:pPr><word:pStyle alt:val="Title"/></word:pPr>
        <word:r><word:t>Native &amp; Ordered</word:t></word:r>
      </word:p>
      <!-- ignored body comment -->
      <word:p>
        <word:r><word:t>Plain &amp; mixed<!-- ignored text comment --><?ignored data?> </word:t></word:r>
        <word:r><word:rPr><word:b/></word:rPr><word:t>bold</word:t></word:r>
        <word:r><word:rPr><word:i/></word:rPr><word:t> italic </word:t></word:r>
        <word:r><word:rPr><word:b/><word:i/></word:rPr><word:t>both</word:t></word:r>
        <word:r><word:rPr><word:b alt:val="0"/><word:i alt:val="0"/></word:rPr><word:t> plain</word:t></word:r>
        <word:r><word:tab/><word:t>tab</word:t><word:br/><word:t>line</word:t><word:br alt:type="page"/><word:t>end</word:t></word:r>
      </word:p>
    `);

    expect(documentXmlToMarkdown(xml)).toBe(
      "# Native & Ordered\n\nPlain & mixed **bold** _italic_ ***both*** plain tab<br>lineend\n",
    );
  });

  test("formats front titles, headings, and list paragraphs", () => {
    const paragraph = (style: string, text: string): string =>
      `<word:p><word:pPr><word:pStyle word:val="${style}"/></word:pPr><word:r><word:t>${text}</word:t></word:r></word:p>`;
    const xml = wordDocument(`
      <word:p><word:r><word:t>USS EXAMPLE</word:t></word:r></word:p>
      <word:p><word:r><word:t>REFERENCE GUIDE</word:t></word:r></word:p>
      <word:p/>
      ${paragraph("Heading1", "Major")}
      ${paragraph("Heading2", "Section")}
      ${paragraph("Heading3", "Topic")}
      ${paragraph("Heading4", "Detail")}
      ${paragraph("Heading5", "Fine")}
      ${paragraph("Heading6", "Finest")}
      ${paragraph("ListParagraph", "First")}
      ${paragraph("ListParagraph", "Second")}
    `);

    expect(documentXmlToMarkdown(xml)).toBe(
      "# USS Example Reference Guide\n\n## Major\n\n### Section\n\n#### Topic\n\n##### Detail\n\n###### Fine\n\n###### Finest\n\n- First\n- Second\n",
    );
  });

  test("formats tables, multiple cell paragraphs, escaped pipes, and short rows", () => {
    const xml = wordDocument(`
      <word:tbl>
        <word:tr>
          <word:tc><word:p><word:r><word:t>Name</word:t></word:r></word:p></word:tc>
          <word:tc><word:p><word:r><word:t>Role | Note</word:t></word:r></word:p></word:tc>
        </word:tr>
        <word:tr>
          <word:tc>
            <word:p><word:r><word:t>A</word:t></word:r></word:p>
            <word:p><word:r><word:rPr><word:i/></word:rPr><word:t>B</word:t></word:r></word:p>
          </word:tc>
        </word:tr>
      </word:tbl>
    `);

    expect(documentXmlToMarkdown(xml)).toBe("| Name | Role \\| Note |\n| --- | --- |\n| A<br>_B_ |  |\n");
  });

  test("preserves legacy normalization of numeric-looking text", () => {
    const xml = wordDocument("<word:p><word:r><word:t>4600.</word:t></word:r></word:p>");

    expect(documentXmlToMarkdown(xml)).toBe("4600\n");
  });

  test("reports native parser details for malformed XML", () => {
    expect(() => documentXmlToMarkdown("<word:document>")).toThrow(
      /^Invalid word\/document\.xml: XML Parse error: Missing closing tag/,
    );
  });

  test("preserves the missing document body error", () => {
    expect(() => documentXmlToMarkdown("<word:document/>", "fixture.docx")).toThrow(
      "DOCX has no Word document body: fixture.docx",
    );
  });
});

test("uppercase body paragraphs retain their text and position", () => {
  const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const document = (body: string) => `<w:document xmlns:w="urn:word"><w:body>${body}</w:body></w:document>`;
  for (const suffix of ["", paragraph("Following paragraph.")]) {
    expect(documentXmlToMarkdown(document(paragraph("Introductory paragraph.") + paragraph("NASA") + suffix))).toBe(
      "Introductory paragraph.\n\nNASA\n" + (suffix ? "\nFollowing paragraph.\n" : ""),
    );
  }
  expect(documentXmlToMarkdown(document(paragraph("FRONT TITLE") + '<w:p/>' + paragraph("NASA")))).toBe("# Front Title\n\nNASA\n");
});

test("pending front titles precede tables and styled paragraphs", () => {
  const title = '<w:p><w:r><w:t>FRONT TITLE</w:t></w:r></w:p>';
  const heading = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Section</w:t></w:r></w:p>';
  const table = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  const body = '<w:p><w:r><w:t>NASA</w:t></w:r></w:p>';
  const document = (content: string) => `<w:document xmlns:w="urn:word"><w:body>${content}</w:body></w:document>`;
  expect(documentXmlToMarkdown(document(title + table + heading))).toBe("# Front Title\n\n| Cell |\n| --- |\n\n## Section\n");
  expect(documentXmlToMarkdown(document(title + heading))).toBe("# Front Title\n\n## Section\n");
  expect(documentXmlToMarkdown(document(table + body))).toBe("| Cell |\n| --- |\n\nNASA\n");
  expect(documentXmlToMarkdown(document(title))).toBe("# Front Title\n");
});

test("content controls preserve nested blocks, table rows, cells, and paragraph order", () => {
  const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const control = (content: string) => `<w:sdt><w:sdtPr><w:alias w:val="Control metadata"/></w:sdtPr><w:sdtContent>${content}</w:sdtContent></w:sdt>`;
  const document = (content: string) => `<w:document xmlns:w="urn:word"><w:body>${content}</w:body></w:document>`;
  const heading = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Section</w:t></w:r></w:p>';
  const table = `<w:tbl>${control(`<w:tr>${control(`<w:tc>${control(paragraph("Cell"))}${paragraph("Second paragraph")}</w:tc>`)}</w:tr>`)}</w:tbl>`;
  expect(documentXmlToMarkdown(document(control(paragraph("Content control paragraph."))))).toBe("Content control paragraph.\n");
  expect(documentXmlToMarkdown(document(
    control(paragraph("FRONT TITLE")) + control(control(heading) + paragraph("Before table.") + control(table)) + paragraph("After table."),
  ))).toBe("# Front Title\n\n## Section\n\nBefore table.\n\n| Cell<br>Second paragraph |\n| --- |\n\nAfter table.\n");
});
