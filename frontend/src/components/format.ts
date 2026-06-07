export function shortId(id: string) {
  return id.slice(0, 8)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No timestamp'
  return new Date(value).toLocaleString()
}
