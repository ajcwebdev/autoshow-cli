export type FalQueueStatus = {
  status: string
  request_id: string
  response_url?: string | undefined
  status_url?: string | undefined
  cancel_url?: string | undefined
  queue_position?: number | undefined
}
