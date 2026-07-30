const { isAllowedOrigin, normalizeOrigin } = require("../../utils/corsConfig");

describe("utils/corsConfig", () => {
  describe("normalizeOrigin", () => {
    it("trims whitespace and trailing slashes", () => {
      expect(normalizeOrigin("  https://fridayinn.webaac.in/  ")).toBe(
        "https://fridayinn.webaac.in",
      );
    });

    it("returns undefined for undefined input", () => {
      expect(normalizeOrigin(undefined)).toBeUndefined();
    });
  });

  describe("isAllowedOrigin", () => {
    it("allows requests with no origin header (e.g. curl, server-to-server)", () => {
      expect(isAllowedOrigin(undefined, { isProd: true })).toBe(true);
    });

    it("allows the exact CLIENT_URL configured in env", () => {
      const env = { CLIENT_URL: "https://fridayinn.webaac.in" };
      expect(
        isAllowedOrigin("https://fridayinn.webaac.in", { isProd: true, env }),
      ).toBe(true);
    });


    it("REGRESSION: rejects the real origin when CLIENT_URL protocol doesn't match (http vs https)", () => {
      const env = { CLIENT_URL: "http://fridayinn.webaac.in" };
      expect(
        isAllowedOrigin("https://fridayinn.webaac.in", { isProd: true, env }),
      ).toBe(false);
    });

    it("rejects an origin that isn't in the allowlist in production", () => {
      const env = { CLIENT_URL: "https://fridayinn.webaac.in" };
      expect(
        isAllowedOrigin("https://some-other-site.com", { isProd: true, env }),
      ).toBe(false);
    });

    it("rejects a trailing-slash mismatch is still fine since normalization strips it", () => {
      const env = { CLIENT_URL: "https://fridayinn.webaac.in/" };
      expect(
        isAllowedOrigin("https://fridayinn.webaac.in", { isProd: true, env }),
      ).toBe(true);
    });

    it("allows configured NETLIFY_URL as a fallback origin", () => {
      const env = {
        CLIENT_URL: "https://fridayinn.webaac.in",
        NETLIFY_URL: "myapp.netlify.app",
      };
      expect(
        isAllowedOrigin("https://myapp.netlify.app", { isProd: true, env }),
      ).toBe(true);
    });

    it("in non-production, allows localhost even if not in CLIENT_URL", () => {
      const env = { CLIENT_URL: "https://fridayinn.webaac.in" };
      expect(
        isAllowedOrigin("http://localhost:5173", { isProd: false, env }),
      ).toBe(true);
    });

    it("in non-production, still rejects a completely unrelated origin", () => {
      const env = { CLIENT_URL: "https://fridayinn.webaac.in" };
      expect(
        isAllowedOrigin("https://random-site.com", { isProd: false, env }),
      ).toBe(false);
    });
  });
});