import { usePlumaStore } from "../state/usePlumaStore.js";
import { NotificationToast } from "./NotificationToast.js";

export function NotificationCenter() {
  const notifications = usePlumaStore((state) => state.status.notifications);

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="notification-center"
    >
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </section>
  );
}
