import { notificationUnreadChangedEvent, notifyUnreadChanged } from './notificationEvents'
import type { NotificationUnreadChangedDetail } from './notificationEvents'

describe('notificationEvents', () => {
  it('exports the correct event name', () => {
    expect(notificationUnreadChangedEvent).toBe('merhouse:notification-unread-changed')
  })

  it('dispatches a CustomEvent with the correct delta', () => {
    const handler = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, handler)

    notifyUnreadChanged(3)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent<NotificationUnreadChangedDetail>
    expect(event.detail).toEqual({ delta: 3 })

    window.removeEventListener(notificationUnreadChangedEvent, handler)
  })

  it('dispatches events with negative deltas', () => {
    const handler = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, handler)

    notifyUnreadChanged(-2)

    const event = handler.mock.calls[0][0] as CustomEvent<NotificationUnreadChangedDetail>
    expect(event.detail.delta).toBe(-2)

    window.removeEventListener(notificationUnreadChangedEvent, handler)
  })

  it('dispatches events with zero delta', () => {
    const handler = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, handler)

    notifyUnreadChanged(0)

    const event = handler.mock.calls[0][0] as CustomEvent<NotificationUnreadChangedDetail>
    expect(event.detail.delta).toBe(0)

    window.removeEventListener(notificationUnreadChangedEvent, handler)
  })

  it('allows multiple listeners to receive the same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, handler1)
    window.addEventListener(notificationUnreadChangedEvent, handler2)

    notifyUnreadChanged(1)

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)

    window.removeEventListener(notificationUnreadChangedEvent, handler1)
    window.removeEventListener(notificationUnreadChangedEvent, handler2)
  })

  it('dispatches separate events for separate calls', () => {
    const handler = vi.fn()
    window.addEventListener(notificationUnreadChangedEvent, handler)

    notifyUnreadChanged(1)
    notifyUnreadChanged(-1)
    notifyUnreadChanged(5)

    expect(handler).toHaveBeenCalledTimes(3)
    expect((handler.mock.calls[0][0] as CustomEvent).detail.delta).toBe(1)
    expect((handler.mock.calls[1][0] as CustomEvent).detail.delta).toBe(-1)
    expect((handler.mock.calls[2][0] as CustomEvent).detail.delta).toBe(5)

    window.removeEventListener(notificationUnreadChangedEvent, handler)
  })
})
