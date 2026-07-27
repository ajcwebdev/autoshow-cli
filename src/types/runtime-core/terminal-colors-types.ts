export type TerminalColorStream = {
  isTTY?: boolean | undefined
}

export type TerminalPaintOptions = {
  enabled?: boolean | undefined
  stream?: TerminalColorStream | undefined
}
