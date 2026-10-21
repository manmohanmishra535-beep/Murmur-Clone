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

  /**
   * Ask for a reset link. The API always answers 202 with the same message;
   * outside production it also returns `resetUrl`, because no SMTP server is
   * assumed to exist on a laptop.
   */
  async forgotPassword(email) {
    const { data } = await api.post(
      "/auth/forgot-password",
      { email },
      { skipAuthRedirect: true }
    );
    return data;
  },

  async resetPassword({ token, password }) {
    const { data } = await api.post(
      "/auth/reset-password",
      { token, password },
      { skipAuthRedirect: true }
    );
    return data;
  },

  /** hydrate on first load; a 401 here just means "no session". */
  async me() {
    const { data } = await api.get("/auth/me", { skipAuthRedirect: true });
    return data;
  },
};
