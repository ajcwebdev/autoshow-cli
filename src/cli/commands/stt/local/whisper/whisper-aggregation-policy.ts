
export const appendWhisperSegmentText = (currentText: string, text: string, isNewSentence: boolean, gapFromPrev: number) => {
  const needsSpaceBefore = currentText.length > 0 &&
                           !currentText.endsWith("'") &&
                           !text.startsWith("'") &&
                           gapFromPrev > 10
  const needsPunctuationBefore = gapFromPrev > 800 &&
                                 currentText.length > 0 &&
                                 !currentText.match(/[.!?,]$/)
  if (needsPunctuationBefore && currentText.length > 0) {
    if (gapFromPrev > 1500) {
      currentText = currentText.trimEnd() + '.'
      isNewSentence = true
    } else if (gapFromPrev > 800) {
      currentText = currentText.trimEnd() + ','
    }
  }
  if (needsSpaceBefore) {
    currentText += ' '
  }
  if (isNewSentence && text.length > 0 && !text.match(/^[.!?,]/)) {
    text = text.charAt(0).toUpperCase() + text.slice(1)
    isNewSentence = false
  }
  currentText += text
  return { currentText, text, isNewSentence }
}

export const resolveWhisperSegmentBreak = (text: string, actualWordCount: number, nextGap: number, isLastSegment: boolean) => {
  const targetWordsPerSegment = 35
  const minWordsPerSegment = 20
  const maxWordsPerSegment = 45
  const hasVeryLongPause = nextGap > 3000
  const hasModerateBreak = nextGap > 1500 && actualWordCount >= minWordsPerSegment
  const reachedTargetWords = actualWordCount >= targetWordsPerSegment
  const reachedMaxWords = actualWordCount >= maxWordsPerSegment
  const naturalBreak = (text.trim().match(/[.!?]$/) || hasVeryLongPause) && actualWordCount >= minWordsPerSegment
  const shouldBreak = isLastSegment ||
                     reachedMaxWords ||
                     (reachedTargetWords && (hasModerateBreak || naturalBreak)) ||
                     (hasVeryLongPause && actualWordCount >= 10) ||
                     (naturalBreak && hasModerateBreak)
  return { shouldBreak, hasVeryLongPause }
}

export const cleanWhisperSegmentText = (text: string, terminal: boolean): string => {
  let cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([A-Za-z])([,.!?;:])([A-Za-z])/g, '$1$2 $3')
  if (!cleanedText.match(/[.!?]$/) && terminal) {
    cleanedText += '.'
  }
  if (cleanedText.length > 0 && !cleanedText.match(/^[A-Z]/)) {
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1)
  }
  return cleanedText
}
