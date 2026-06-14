import { formatDateTime, shortId } from './format'

describe('shortId', () => {
  it('returns the first 8 characters of a UUID', () => {
    expect(shortId('12345678-abcd-efgh-ijkl-mnopqrstuvwx')).toBe('12345678')
  })

  it('returns the first 8 characters of a short string', () => {
    expect(shortId('abcdefghij')).toBe('abcdefgh')
  })

  it('returns the full string if shorter than 8 characters', () => {
    expect(shortId('abc')).toBe('abc')
  })

  it('returns empty string for empty input', () => {
    expect(shortId('')).toBe('')
  })

  it('handles exactly 8 characters', () => {
    expect(shortId('12345678')).toBe('12345678')
  })

  it('handles 7 characters (boundary)', () => {
    expect(shortId('1234567')).toBe('1234567')
  })

  it('handles 9 characters (boundary)', () => {
    expect(shortId('123456789')).toBe('12345678')
  })
})

describe('formatDateTime', () => {
  it('returns formatted date for valid ISO string', () => {
    const result = formatDateTime('2026-06-14T12:00:00Z')
    // toLocaleString() output depends on locale, but should not be the fallback
    expect(result).not.toBe('No timestamp')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns "No timestamp" for null', () => {
    expect(formatDateTime(null)).toBe('No timestamp')
  })

  it('returns "No timestamp" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('No timestamp')
  })

  it('returns "No timestamp" for empty string', () => {
    expect(formatDateTime('')).toBe('No timestamp')
  })

  it('returns a date representation for valid date strings', () => {
    const result = formatDateTime('2026-01-15T08:30:00Z')
    expect(result).toBeTruthy()
    expect(result).not.toBe('No timestamp')
  })

  it('handles date-only strings', () => {
    const result = formatDateTime('2026-01-15')
    expect(result).not.toBe('No timestamp')
  })
})
