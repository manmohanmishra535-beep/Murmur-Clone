import axios from "axios";

/**
 * The only Axios instance in the app. Components never call Axios directly;
 * they go through a service, which goes through this.
 *
 * Clerk's session token is attached as a bearer header. Nothing is stored in
 * localStorage and no cookie is sent, which keeps the API and the web app on
 * separate origins without any cross-site cookie configuration.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  timeout: 15000,
  headers: { Accept: "application/json" },
});

let tokenGetter = null;
let unauthorizedHandler = null;

/** AuthProvider registers Clerk's getToken on mount. */
export function setTokenGetter(getter) {
  tokenGetter = getter;
}

/** AuthProvider registers the "session ended" behaviour on mount. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use(async (config) => {
  if (!tokenGetter) return config;
  const token = await tokenGetter();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    // A 401 on /auth/me is expected during hydration and must not redirect.
    if (status === 401 && !error.config?.skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from the API's standard error body. */
export function errorMessage(error, fallback = "Something went wrong. Try again.") {
  return (
    (error.response && error.response.data && error.response.data.error && error.response.data.error.message) ||
    (error.request ? "Cannot reach the Murmur API. Is it running?" : "") ||
    error.message ||
    fallback
  );
}

/** { email: "Enter a full address…" } or {}. */
export function errorFields(error) {
  return (error.response && error.response.data && error.response.data.error && error.response.data.error.fields) || {};
}

export function errorCode(error) {
  return (error.response && error.response.data && error.response.data.error && error.response.data.error.code) || "";
}
