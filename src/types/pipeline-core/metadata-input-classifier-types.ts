type MetadataInputKind =
  | 'url_streaming'
  | 'url_direct_media'
  | 'url_direct_document'
  | 'url_html_article'
  | 'url_x_space'
  | 'local_media'
  | 'local_document'

export type UrlInputKind = Extract<MetadataInputKind, `url_${string}`>
