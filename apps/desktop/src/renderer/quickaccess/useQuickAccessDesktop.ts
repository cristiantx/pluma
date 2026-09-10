import { useEffect } from "react";
import { usePlumaStore, type QuickAccessServices } from "@pluma/ui";
import { createQuickAccessSearchAdapter } from "./quickAccessSearchAdapter";

export function useQuickAccessDesktop() {
  useEffect(() => {
    const bridge = window.pluma;
    if (!bridge) return;
    let search = createQuickAccessSearchAdapter();
    const services: QuickAccessServices = {
      platform: bridge.platform,
      nativeAccelerators: true,
      search: (candidates, query) => search.search(candidates, query),
      execute: (request, context) => bridge.runCommand({ request, context }),
      activate: (target) => bridge.quickAccess(target),
      flush: () => bridge.quickAccess({ kind: "flush" }),
      setOpen: (open) => {
        void bridge.quickAccess({ kind: "set-open", open });
      },
      refresh: () => {
        search.dispose();
        search = createQuickAccessSearchAdapter();
        return bridge.quickAccess({ kind: "refresh" });
      }
    };
    usePlumaStore.getState().setQuickAccessServices(services);
    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === "quick-access-request")
        usePlumaStore.getState().openQuickAccess(event.mode);
    });
    return () => {
      unsubscribe();
      search.dispose();
      services.setOpen(false);
    };
  }, []);
}
