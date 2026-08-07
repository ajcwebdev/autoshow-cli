/**
 * `getFetchableDocumentationUrl` strips a `blob:` prefix before fetching, so a link
 * recorded in its browser `blob:https://…` form still resolves while the output keeps
 * citing the original spelling.
 *
 * These are synthetic on purpose. The tests used to reach for whichever provider
 * manifest happened to contain a `blob:` entry, which tied a general fetch-layer feature
 * to one provider's data — so cleaning up that provider's links broke a test that has
 * nothing to do with it. Driving the behaviour through direct-URL mode keeps it pinned
 * no matter what the registry contains.
 */
export const BLOB_PREFIXED_DOC_LINK = 'blob:https://docs.example.com/de495975-7e82-4fd9-953a-2fe2c257845e'
export const BLOB_PREFIXED_DOC_FETCH_LINK = 'https://docs.example.com/de495975-7e82-4fd9-953a-2fe2c257845e'

export const linksTestOutputPath = (name: string): string =>
  `/tmp/autoshow-links-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
