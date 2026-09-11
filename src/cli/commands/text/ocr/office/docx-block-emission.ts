import type { XmlElement } from './docx-body-reader'
import { contentChildren, localName } from './docx-body-reader'
import { paragraphStyle, paragraphText, plainParagraphText } from './docx-inline-markdown'

function tableMarkdown(table: XmlElement): string[] {
  const rows = contentChildren(table).filter((node) => localName(node.name) === "tr").map((row) =>
    contentChildren(row).filter((node) => localName(node.name) === "tc").map((cell) =>
      contentChildren(cell).filter((node) => localName(node.name) === "p")
        .map(paragraphText)
        .filter(Boolean)
        .join("<br>")
        .replaceAll("|", "\\|"),
    ),
  );

  if (!rows.length) return [];

  const firstRow = rows[0]!;
  const width = Math.max(...rows.map((row) => row.length));
  for (const row of rows) while (row.length < width) row.push("");

  return [
    `| ${firstRow.join(" | ")} |`,
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`),
    "",
  ];
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word === "USS" ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

export type DocxBlockState = { lines: string[]; frontMatter: boolean; frontTitle: string[] };

export function flushDocxFrontTitle(state: DocxBlockState): void {
  if (state.frontTitle.length) {
    state.lines.push(`# ${state.frontTitle.join(" ")}`, "");
    state.frontTitle.length = 0;
  }
}

function consumeDocxFrontTitle(state: DocxBlockState, node: XmlElement, style: string, text: string): boolean {
  if (!state.frontMatter || style !== "Normal") return false;
  if (!text) {
    if (state.frontTitle.length) {
      flushDocxFrontTitle(state);
      state.frontMatter = false;
    }
    return true;
  }
  const plainText = plainParagraphText(node);
  if (state.frontTitle.length >= 2 || plainText !== plainText.toUpperCase() || !/[A-Z]/.test(plainText)) return false;
  state.frontTitle.push(titleCase(plainText));
  return true;
}

function docxStylePrefix(style: string): string {
  const prefixes: Readonly<Record<string, string>> = { Title: "# ", Heading1: "## ", Heading2: "### ", Heading3: "#### ", Heading4: "##### ", Heading5: "###### ", Heading6: "###### ", ListParagraph: "- " };
  return Object.hasOwn(prefixes, style) ? prefixes[style]! : "";
}

function emitDocxParagraph(state: DocxBlockState, node: XmlElement): void {
  const style = paragraphStyle(node);
  const text = paragraphText(node);
  if (consumeDocxFrontTitle(state, node, style, text)) return;
  flushDocxFrontTitle(state);
  state.frontMatter = false;
  if (!text) {
    if (state.lines.at(-1) !== "") state.lines.push("");
    return;
  }
  state.lines.push(`${docxStylePrefix(style)}${text}`);
  if (style !== "ListParagraph") state.lines.push("");
}

export function emitDocxBodyBlock(state: DocxBlockState, node: XmlElement): void {
  if (localName(node.name) === "tbl") {
    flushDocxFrontTitle(state);
    state.frontMatter = false;
    state.lines.push(...tableMarkdown(node));
  } else if (localName(node.name) === "p") {
    emitDocxParagraph(state, node);
  }
}
