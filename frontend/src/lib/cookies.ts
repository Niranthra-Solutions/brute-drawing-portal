import Cookies from "js-cookie";

/**
 * Cookies used by the SPA itself: NON-sensitive UI preferences only.
 * Authentication cookies (dp_at / dp_rt) are HttpOnly, SameSite=Strict and set by the API — JavaScript can never read them
 * (that is the point: an XSS bug cannot steal the session). axios just sends them via `withCredentials`.
 */
const base = {
  sameSite: "strict" as const,
  secure: typeof location !== "undefined" && location.protocol === "https:",
  expires: 365,
  path: "/",
};

export const prefs = {
  sidebarCollapsed: () => Cookies.get("dp_sidebar") === "1",
  setSidebarCollapsed: (v: boolean) =>
    Cookies.set("dp_sidebar", v ? "1" : "0", base),
  lastEmail: () => Cookies.get("dp_last_email") ?? "",
  setLastEmail: (v: string) =>
    v
      ? Cookies.set("dp_last_email", v, base)
      : Cookies.remove("dp_last_email", { path: "/" }),
  pageSize: (def = 20) => {
    const n = Number(Cookies.get("dp_page_size"));
    return [10, 20, 25, 50, 100].includes(n) ? n : def;
  },
  setPageSize: (n: number) => Cookies.set("dp_page_size", String(n), base),
};
