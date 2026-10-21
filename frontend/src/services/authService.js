import { api } from "./api";

export const authService = {
  /**
   * Hydrate the app profile behind the Clerk session. The first call after
   * sign-up creates that profile, so this doubles as "make sure I exist".
   * A 401 here means the API did not accept the session; AuthProvider decides
   * what to do with it.
   */
  async me() {
    const { data } = await api.get("/auth/me", { skipAuthRedirect: true });
    return data;
  },
};
