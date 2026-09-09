import { openZip, readZipEntryData } from '~/cli/commands/process-steps/step-1-download/document/zip-xml-utils';
import { XML } from "bun";

type XmlElement = Bun.XML.Node;
type XmlChild = XmlElement["children"][number];

const numberPattern = /^([-+])?(0*)([0-9]*(\.[0-9]*)?)$/;
const exponentPattern = /^([-+])?(0*)(\d*(\.\d*)?[eE][-+]?\d+)$/;
const hexPattern = /^[-+]?0x[a-fA-F0-9]+$/;

function localName(name: string): string {
  const separator = name.lastIndexOf(":");
  return separator === -1 ? name : name.slice(separator + 1);
}

function isElement(child: XmlChild): child is XmlElement {
  return typeof child === "object" && child !== null && "name" in child;
}

function directChildren(node: XmlElement, name: string): XmlElement[] {
  return node.children.filter((child): child is XmlElement => isElement(child) && localName(child.name) === name);
}

// Content controls wrap blocks, rows, or cells without changing their order.
// Only unwrap sdtContent; sdtPr contains control metadata, not document text.
function contentChildren(node: XmlElement): XmlElement[] {
  return node.children.flatMap((child): XmlElement[] => {
    if (!isElement(child)) return [];
    if (localName(child.name) === "sdt") {
      return directChildren(child, "sdtContent").flatMap(contentChildren);
    }
    return [child];
  });
}

function descendants(node: XmlElement, names: ReadonlySet<string>): XmlElement[] {
  const matches: XmlElement[] = [];
  for (const child of node.children) {
    if (!isElement(child)) continue;
    if (names.has(localName(child.name))) matches.push(child);
    matches.push(...descendants(child, names));
  }
  return matches;
}

function nodeAttribute(node: XmlElement | undefined, name: string): string | undefined {
  return Object.entries(node?.attributes ?? {}).find(([attributeName]) => localName(attributeName) === name)?.[1];
}

function trimNumericZeros(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "");
  if (trimmed === ".") return "0";
  if (trimmed.startsWith(".")) return `0${trimmed}`;
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

function legacyTextValue(value: string): string {
  if (!value || value.trim() !== value || value === "true" || value === "false") return value;
  if (value === "0") return value;
  if (hexPattern.test(value)) return String(Number.parseInt(value, 16));

  if (/.+[eE].+/.test(value)) {
    const notation = value.match(exponentPattern);
    if (!notation) return value;
    const sign = notation[1] ?? "";
    const leadingZeros = notation[2] ?? "";
    const exponential = notation[3]!;
    const exponentCharacter = exponential.includes("e") ? "e" : "E";
    const exponentAdjacentToZeros = value[leadingZeros.length + (sign ? 1 : 0)] === exponentCharacter;
    if (leadingZeros.length > 1 && exponentAdjacentToZeros) return value;
    if (
      leadingZeros.length === 1 &&
      (exponential.startsWith(`.${exponentCharacter}`) || exponential.startsWith(exponentCharacter))
    ) {
      return String(Number(value));
    }
    return exponentAdjacentToZeros ? value : String(Number(`${sign}${exponential}`));
  }

  const match = value.match(numberPattern);
  if (!match) return value;
  const sign = match[1] ?? "";
  const leadingZeros = match[2] ?? "";
  const numericWithoutLeadingZeros = trimNumericZeros(match[3]!);
  const number = Number(value);
  const parsed = String(number);
  if (number === 0) return parsed;
  if (/[eE]/.test(parsed)) return parsed;
  if (value.includes(".")) {
    return parsed === numericWithoutLeadingZeros || parsed === `${sign}${numericWithoutLeadingZeros}` ? parsed : value;
  }
  const comparable = leadingZeros ? numericWithoutLeadingZeros : value;
  return comparable === parsed || comparable === `${sign}${parsed}` ? parsed : value;
}

function nodeText(node: XmlElement): string {
  return node.children
    .map((child) => (typeof child === "string" ? legacyTextValue(child) : isElement(child) ? nodeText(child) : ""))
    .join("");
}

function runMarkdown(run: XmlElement): string {
  const text = descendants(run, new Set(["t", "tab", "br"]))
    .map((node) => {
      switch (localName(node.name)) {
        case "tab":
          return " ";
        case "br":
          return nodeAttribute(node, "type") === "page" ? "" : "<br>";
        default:
          return nodeText(node);
      }
    })
    .join("");

  if (!text) return "";

  const properties = directChildren(run, "rPr")[0];
  const boldNode = properties && directChildren(properties, "b")[0];
  const italicNode = properties && directChildren(properties, "i")[0];
  const bold = Boolean(boldNode) && nodeAttribute(boldNode, "val") !== "0";
  const italic = Boolean(italicNode) && nodeAttribute(italicNode, "val") !== "0";
  const marker = bold && italic ? "***" : bold ? "**" : italic ? "_" : undefined;
  if (!marker) return text;

  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();
  return core ? `${leading}${marker}${core}${marker}${trailing}` : text;
}

function paragraphText(paragraph: XmlElement): string {
  return descendants(paragraph, new Set(["r"]))
    .map(runMarkdown)
    .join("")
    .trim();
}

function plainParagraphText(paragraph: XmlElement): string {
  return descendants(paragraph, new Set(["t"]))
    .map(nodeText)
    .join("")
    .trim();
}

function paragraphStyle(paragraph: XmlElement): string {
  const properties = directChildren(paragraph, "pPr")[0];
  const style = properties && directChildren(properties, "pStyle")[0];
  return nodeAttribute(style, "val") ?? "Normal";
}

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

export async function readDocxMarkdown(inputPath: string): Promise<string> {
  const { buf, entries } = await openZip(inputPath);
  const entry = entries.get('word/document.xml');
  if (!entry) throw new Error('Could not read word/document.xml');
  return documentXmlToMarkdown(readZipEntryData(buf, entry).toString('utf8'), inputPath);
}

export function documentXmlToMarkdown(xml: string, inputPath = "word/document.xml"): string {
  let parsed: XmlElement;
  try {
    parsed = XML.parse(xml, { compact: false });
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid word/document.xml: ${error.message}`);
    throw error;
  }

  const documentNode = localName(parsed.name) === "document" ? parsed : undefined;
  const body = documentNode && descendants(documentNode, new Set(["body"]))[0];
  if (!body) throw new Error(`DOCX has no Word document body: ${inputPath}`);

  const lines: string[] = [];
  let frontMatter = true;
  const frontTitle: string[] = [];
  const flushFrontTitle = (): void => {
    if (frontTitle.length) {
      lines.push(`# ${frontTitle.join(" ")}`, "");
      frontTitle.length = 0;
    }
  };

  for (const node of contentChildren(body)) {
    if (localName(node.name) === "tbl") {
      flushFrontTitle();
      frontMatter = false;
      lines.push(...tableMarkdown(node));
      continue;
    }
    if (localName(node.name) !== "p") continue;

    const style = paragraphStyle(node);
    const text = paragraphText(node);

    if (frontMatter && style === "Normal") {
      if (!text) {
        if (frontTitle.length) {
          flushFrontTitle();
          frontMatter = false;
        }
        continue;
      }

      const plainText = plainParagraphText(node);
      if (frontTitle.length < 2 && plainText === plainText.toUpperCase() && /[A-Z]/.test(plainText)) {
        frontTitle.push(titleCase(plainText));
        continue;
      }
    }

    flushFrontTitle();
    frontMatter = false;
    if (!text) {
      if (lines.at(-1) !== "") lines.push("");
      continue;
    }

    const prefix =
      style === "Title"
        ? "# "
        : style === "Heading1"
          ? "## "
          : style === "Heading2"
            ? "### "
            : style === "Heading3"
              ? "#### "
              : style === "Heading4"
                ? "##### "
                : style === "Heading5" || style === "Heading6"
                  ? "###### "
                  : style === "ListParagraph"
                    ? "- "
                    : "";

    lines.push(`${prefix}${text}`);
    if (style !== "ListParagraph") lines.push("");
  }

  flushFrontTitle();

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s*$/, "\n");
}
