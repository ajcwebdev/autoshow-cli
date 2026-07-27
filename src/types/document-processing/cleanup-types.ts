export type HtmlRewriterElement = {
  tagName: string
  selfClosing: boolean
  canHaveContent: boolean
  getAttribute: (name: string) => string | null
  onEndTag: (handler: () => void) => void
}

type HtmlRewriterInstance = {
  on: (selector: string, handlers: {
    element?: (element: HtmlRewriterElement) => void
    text?: (text: { text: string }) => void
  }) => HtmlRewriterInstance
  transform: (response: Response) => Response
}

export type HtmlRewriterConstructor = new () => HtmlRewriterInstance

export type ExtractionState = {
  bodyDepth: number
  bodyText: string
  documentText: string
  hasBody: boolean
  skipDepth: number
}
