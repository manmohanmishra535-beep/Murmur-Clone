import { api } from "./api";

export const authService = {
  async register({ username, email, password }) {
    const { data } = await api.post(
      "/auth/register",
      { username, email, password },
      { skipAuthRedirect: true }
    );
    return data;
  },

  async login({ email, password }) {
    const { data } = await api.post(
      "/auth/login",
      { email, password },
      { skipAuthRedirect: true }
    );
    return data;
  },

  async logout() {
    await api.post("/auth/logout");
  },

  /** hydrate on first load; a 401 here just means "no session". */
  async me() {
    const { data } = await api.get("/auth/me", { skipAuthRedirect: true });
    return data;
  },
};
