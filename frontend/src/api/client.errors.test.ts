import { ApiError, api } from './client'

describe('api client error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws ApiError with status, message, and details for JSON error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockResolvedValue({
        error: 'Validation failed',
        details: ['email is required', 'password too short'],
      }),
    }))

    try {
      await api.me('some-token')
      expect.fail('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      const apiError = error as ApiError
      expect(apiError.status).toBe(422)
      expect(apiError.message).toBe('Validation failed')
      expect(apiError.details).toEqual(['email is required', 'password too short'])
    }
  })

  it('falls back to statusText when error response has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue({ message: 'not the error field' }),
    }))

    await expect(api.me('token')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
      details: [],
    })
  })

  it('handles non-JSON error responses gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
    }))

    await expect(api.me('token')).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
      details: [],
    })
  })

  it('propagates network errors without wrapping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api.me('token')).rejects.toThrow('Failed to fetch')
  })

  it('returns undefined for 204 No Content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: vi.fn(),
    }))

    const result = await api.me('some-token')
    expect(result).toBeUndefined()
  })

  it('does not include details when error response details is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue({
        error: 'Conflict',
        details: 'not-an-array',
      }),
    }))

    await expect(api.me('token')).rejects.toMatchObject({
      status: 409,
      message: 'Conflict',
      details: [],
    })
  })
})

describe('api client authentication headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not send Authorization header when token is null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationPreferences('')

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBeNull()
  })

  it('sends Authorization Bearer header for authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationPreferences('my-jwt-token')

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer my-jwt-token')
  })

  it('does not send Content-Type for bodyless GET requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.tenants('token')

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Content-Type')).toBeNull()
  })

  it('always sends Accept application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.tenants('token')

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Accept')).toBe('application/json')
  })
})

describe('api client query parameter handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('omits page parameter when page is 0 for notification deliveries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationDeliveries('token', 50)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/notifications/deliveries?limit=50')
  })

  it('includes page parameter when page is greater than 0', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationDeliveries('token', 50, undefined, 3)

    expect(fetchMock.mock.calls[0][0]).toContain('page=3')
  })

  it('includes status filter when provided for notification deliveries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationDeliveries('token', 25, 'RECORDED')

    expect(fetchMock.mock.calls[0][0]).toContain('status=RECORDED')
  })

  it('includes merchantId filter for order imports when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.orderImports('token', 'merchant-123')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/orders/imports?merchantId=merchant-123')
  })

  it('omits merchantId query for order imports when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.orderImports('token')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/orders/imports')
  })

  it('includes warehouseId filter for fulfillment allocations when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.fulfillmentAllocations('token', 'wh-1')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/fulfillment-allocations?warehouseId=wh-1')
  })

  it('uses default limit values for paginated endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.notificationDeliveries('token')
    expect(fetchMock.mock.calls[0][0]).toContain('limit=50')

    await api.outboxEvents('token')
    expect(fetchMock.mock.calls[1][0]).toContain('limit=25')

    await api.adminAuditEvents('token')
    expect(fetchMock.mock.calls[2][0]).toContain('limit=50')
  })
})

describe('ApiError class', () => {
  it('constructs with status, message, and default empty details', () => {
    const error = new ApiError(404, 'Not Found')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Not Found')
    expect(error.details).toEqual([])
  })

  it('constructs with explicit details', () => {
    const error = new ApiError(400, 'Bad', ['detail-1', 'detail-2'])
    expect(error.details).toEqual(['detail-1', 'detail-2'])
  })

  it('has a proper Error prototype chain', () => {
    const error = new ApiError(500, 'Server Error')
    expect(error instanceof Error).toBe(true)
    expect(error.name).toBe('Error')
  })
})

describe('api client concurrent request safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('handles multiple simultaneous requests independently', async () => {
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++
      const count = callCount
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: count !== 2,
            status: count === 2 ? 500 : 200,
            statusText: count === 2 ? 'Server Error' : 'OK',
            json: count === 2
              ? vi.fn().mockResolvedValue({ error: 'Server Error', details: [] })
              : vi.fn().mockResolvedValue({ id: `result-${count}` }),
          })
        }, count * 10)
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.allSettled([
      api.tenants('token'),
      api.tenants('token'),
      api.tenants('token'),
    ])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')

    if (results[0].status === 'fulfilled') {
      expect(results[0].value).toEqual({ id: 'result-1' })
    }
    if (results[1].status === 'rejected') {
      expect(results[1].reason).toBeInstanceOf(ApiError)
      expect((results[1].reason as ApiError).status).toBe(500)
    }
  })
})
