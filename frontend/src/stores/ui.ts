import { create } from "zustand";
import { prefs } from "@/lib/cookies";

interface UiState {
  mobileNav: boolean;
  collapsed: boolean;
  setMobileNav: (v: boolean) => void;
  toggleCollapsed: () => void;
}
/** UI state lives in Zustand; the collapsed-sidebar preference is mirrored to a (non-sensitive) cookie. */
export const useUi = create<UiState>((set, get) => ({
  mobileNav: false,
  collapsed: prefs.sidebarCollapsed(),
  setMobileNav: (v) => set({ mobileNav: v }),
  toggleCollapsed: () => {
    const v = !get().collapsed;
    prefs.setSidebarCollapsed(v);
    set({ collapsed: v });
  },
}));
