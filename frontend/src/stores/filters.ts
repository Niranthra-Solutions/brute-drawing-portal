import { create } from "zustand";
import { prefs } from "@/lib/cookies";

export interface ListFilters {
  q: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  [k: string]: string | number;
}
interface FilterStore {
  drawings: ListFilters;
  requests: ListFilters;
  set: (key: "drawings" | "requests", patch: Partial<ListFilters>) => void;
  reset: (key: "drawings" | "requests") => void;
}
const defaults = (sort: string): ListFilters => ({
  q: "",
  sort,
  dir: "desc",
  page: 1,
  pageSize: prefs.pageSize(25),
});

/** Remembers each list's filters/sort/page while you move around, so "back" returns you exactly where you were. */
export const useFilters = create<FilterStore>((set) => ({
  drawings: {
    ...defaults("updated"),
    categoryId: "",
    makeId: "",
    voltageV: "",
    status: "",
  },
  requests: { ...defaults("submitted"), type: "", status: "", priority: "" },
  set: (key, patch) =>
    set((s) => {
      if (patch.pageSize) prefs.setPageSize(patch.pageSize);
      const resetsPage = Object.keys(patch).some((k) => k !== "page");
      return {
        [key]: {
          ...s[key],
          ...(resetsPage && patch.page === undefined ? { page: 1 } : {}),
          ...patch,
        },
      } as Pick<FilterStore, typeof key>;
    }),
  reset: (key) =>
    set(
      () =>
        ({
          [key]:
            key === "drawings"
              ? {
                  ...defaults("updated"),
                  categoryId: "",
                  makeId: "",
                  voltageV: "",
                  status: "",
                }
              : {
                  ...defaults("submitted"),
                  type: "",
                  status: "",
                  priority: "",
                },
        }) as never,
    ),
}));
