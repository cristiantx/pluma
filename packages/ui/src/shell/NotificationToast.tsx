import { useEffect } from "react";
import { X } from "lucide-react";

import type { PlumaNotification } from "../state/plumaStoreTypes.js";
import { usePlumaStore } from "../state/usePlumaStore.js";

type NotificationToastProps = {
  notification: PlumaNotification;
};

const notificationDurationMs = 4_500;

export function NotificationToast({ notification }: NotificationToastProps) {
  const dismissNotification = usePlumaStore(
    (state) => state.dismissNotification
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      dismissNotification(notification.id);
    }, notificationDurationMs);

    return () => window.clearTimeout(timeout);
  }, [dismissNotification, notification.id]);

  return (
    <div
      className="notification-toast"
      data-tone={notification.tone}
      role={notification.tone === "error" ? "alert" : "status"}
    >
      <span>{notification.message}</span>
      <button
        aria-label="Dismiss notification"
        className="notification-dismiss"
        onClick={() => dismissNotification(notification.id)}
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
