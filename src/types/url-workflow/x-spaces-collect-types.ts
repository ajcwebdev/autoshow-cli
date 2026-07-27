import type { ParsedSpaceInput, SpacesClientContract } from '~/types'

export interface CollectSpacesOptions {
  client: SpacesClientContract;
  input?: ParsedSpaceInput;
  now?: () => Date;
  username?: string;
}
