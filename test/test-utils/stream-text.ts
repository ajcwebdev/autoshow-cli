export const readBunSpawnStreamText = async (
  stream: ReadableStream<Uint8Array> | number | undefined | null
): Promise<string> => stream && typeof stream !== 'number' ? await new Response(stream).text() : ''
