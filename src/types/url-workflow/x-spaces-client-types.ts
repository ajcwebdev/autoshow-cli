import type { XApiProblem, XIncludes, XPost, XUser } from '~/types'

export type MergeableXListResponse<TData> = {
  data?: TData[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: {
    users?: XUser[] | undefined;
  } | undefined;
};

export interface XApiClientOptions {
  baseUrl?: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  verbose?: boolean;
}

interface XListMeta {
  newest_id?: string | undefined;
  next_token?: string | undefined;
  oldest_id?: string | undefined;
  result_count?: number | undefined;
}

export interface XPostSearchResponse {
  data?: XPost[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
  meta?: XListMeta | undefined;
}

export interface XUserLookupResponse {
  data?: XUser | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
}
