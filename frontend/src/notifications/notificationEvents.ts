export const notificationUnreadChangedEvent = 'merhouse:notification-unread-changed'

export type NotificationUnreadChangedDetail = {
  delta: number
}

export function notifyUnreadChanged(delta: number) {
  window.dispatchEvent(new CustomEvent<NotificationUnreadChangedDetail>(notificationUnreadChangedEvent, {
    detail: { delta },
  }))
}
