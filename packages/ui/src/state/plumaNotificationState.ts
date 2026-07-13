import type { NotificationTone, StatusSlice } from "./plumaStoreTypes.js";

let nextNotificationId = 0;

export function addNotification(
  status: StatusSlice,
  message: string,
  tone: NotificationTone
): StatusSlice {
  if (
    status.notifications.some(
      (notification) =>
        notification.message === message && notification.tone === tone
    )
  ) {
    return status;
  }

  nextNotificationId += 1;

  return {
    ...status,
    notifications: [
      ...status.notifications.slice(-3),
      {
        id: `notification-${nextNotificationId}`,
        message,
        tone
      }
    ]
  };
}

export function removeNotification(
  status: StatusSlice,
  notificationId: string
): StatusSlice {
  return {
    ...status,
    notifications: status.notifications.filter(
      (notification) => notification.id !== notificationId
    )
  };
}
