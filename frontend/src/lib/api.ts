import axios, { AxiosError, type AxiosRequestConfig } from "axios";

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(
    status: number,
    message: string,
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

/** withCredentials sends the HttpOnly auth cookies; X-Requested-With is the CSRF header the API requires on every state-changing call. */
export const http = axios.create({
  withCredentials: true,
  timeout: 120_000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const ax = e as AxiosError<{
      title?: string;
      errors?: Record<string, string[]>;
    }>;
    const s = ax.response?.status ?? 0;
    let title =
      s === 0
        ? "Network error. Check your connection and try again."
        : s === 429
          ? "Too many requests. Please wait a moment and try again."
          : s === 403
            ? "You do not have permission to do that."
            : s === 413
              ? "The file is too large."
              : "Something went wrong. Please try again.";
    const fields: Record<string, string> = {};
    const d = ax.response?.data;
    if (d && typeof d === "object") {
      if (d.title) title = d.title;
      if (d.errors)
        for (const [k, v] of Object.entries(d.errors))
          fields[k.charAt(0).toLowerCase() + k.slice(1)] = v[0];
    }
    return new ApiError(s, fields.file ?? title, fields);
  }
  return new ApiError(0, "Unexpected error.");
}

let refreshing: Promise<boolean> | null = null;
const refreshSession = () =>
  (refreshing ??= http
    .post("/api/auth/refresh")
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    }));

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const cfg = error.config as
      (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      cfg &&
      !cfg._retried &&
      !cfg.url?.startsWith("/api/auth/")
    ) {
      cfg._retried = true;
      if (await refreshSession()) return http(cfg);
      onUnauthorized?.();
    }
    return Promise.reject(toApiError(error));
  },
);

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    http.get<T>(url, { params }).then((r) => r.data),
  post: <T>(url: string, body?: unknown) =>
    http.post<T>(url, body ?? {}).then((r) => r.data),
  put: <T>(url: string, body?: unknown) =>
    http.put<T>(url, body ?? {}).then((r) => r.data),
  del: <T = void>(url: string) => http.delete<T>(url).then((r) => r.data),
};

export function qs(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** Multipart upload with real progress (axios onUploadProgress). */
export async function upload<T>(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return http
    .post<T>(url, fd, {
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    })
    .then((r) => r.data);
}
export const postForm = <T>(url: string, fd: FormData) =>
  http.post<T>(url, fd).then((r) => r.data);
