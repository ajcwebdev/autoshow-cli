export type HeadingKind = 'chapter' | 'appendix' | 'named' | 'backmatter' | 'numbered' | 'about-author'

export type HeadingDetectionContext = {
  titleLikeKeys: ReadonlySet<string>
}
