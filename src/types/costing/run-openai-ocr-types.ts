export type OpenAIOcrInputContent =
  | {
      type: 'input_file'
      filename: string
      file_data: string
    }
  | {
      type: 'input_image'
      detail: 'high'
      image_url: string
    }
