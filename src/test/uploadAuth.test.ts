import { describe, it, expect, beforeEach } from "vitest";
import {
  isCompactJWS,
  getTokenPayload,
  isTokenExpired,
  hasValidSub,
  purgeCorruptedStorageTokens,
  getValidUploadAuth,
  DEMO_CREDENTIALS,
} from "@/lib/uploadAuth";

describe("uploadAuth token validation & recovery", () => {
  const createMockJwt = (payload: Record<string, any>): string => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "");
    const body = btoa(JSON.stringify(payload)).replace(/=/g, "");
    const sig = "mock_signature_hash_12345";
    return `${header}.${body}.${sig}`;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe("isCompactJWS", () => {
    it("returns false for null, undefined, and empty string", () => {
      expect(isCompactJWS(null)).toBe(false);
      expect(isCompactJWS(undefined)).toBe(false);
      expect(isCompactJWS("")).toBe(false);
    });

    it("returns false for dummy local tokens like 'demo-jwt-token-local'", () => {
      expect(isCompactJWS("demo-jwt-token-local")).toBe(false);
    });

    it("returns false for strings with fewer or more than 3 segments", () => {
      expect(isCompactJWS("abc.def")).toBe(false);
      expect(isCompactJWS("abc.def.ghi.jkl")).toBe(false);
      expect(isCompactJWS("abc..def")).toBe(false);
    });

    it("returns true for a valid 3-part base64url token", () => {
      const validJwt = createMockJwt({ sub: "user-123", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
      expect(isCompactJWS(validJwt)).toBe(true);
    });
  });

  describe("getTokenPayload", () => {
    it("safely extracts the payload from a compact JWS", () => {
      const jwt = createMockJwt({ sub: "5196571f-b9ad-457c-b2e3-c07f13f6f1a3", role: "authenticated" });
      const payload = getTokenPayload(jwt);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe("5196571f-b9ad-457c-b2e3-c07f13f6f1a3");
      expect(payload?.role).toBe("authenticated");
    });

    it("returns null for non-compact JWS", () => {
      expect(getTokenPayload("invalid-token")).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("returns true if token has expired exp timestamp", () => {
      const expiredJwt = createMockJwt({ sub: "123", exp: Math.floor(Date.now() / 1000) - 100 });
      expect(isTokenExpired(expiredJwt)).toBe(true);
    });

    it("returns false if token exp is in the future", () => {
      const futureJwt = createMockJwt({ sub: "123", exp: Math.floor(Date.now() / 1000) + 3600 });
      expect(isTokenExpired(futureJwt)).toBe(false);
    });
  });

  describe("hasValidSub", () => {
    it("rejects dummy or corrupted tokens", () => {
      expect(hasValidSub(null)).toBe(false);
      expect(hasValidSub({ access_token: "demo-jwt-token-local" } as any)).toBe(false);
      expect(hasValidSub({ access_token: "" } as any)).toBe(false);
    });

    it("accepts valid compact JWS with a sub claim", () => {
      const validJwt = createMockJwt({ sub: "creator-demo-id", role: "authenticated" });
      expect(hasValidSub({ access_token: validJwt } as any)).toBe(true);
    });

    it("rejects token without sub claim", () => {
      const anonJwt = createMockJwt({ role: "anon" });
      expect(hasValidSub({ access_token: anonJwt } as any)).toBe(false);
    });
  });

  describe("purgeCorruptedStorageTokens", () => {
    it("purges corrupted tokens from localStorage while leaving valid data intact", () => {
      // Seed corrupted token
      localStorage.setItem("sb-mqotnlflwrgqpbhjkwyq-auth-token", JSON.stringify({
        access_token: "demo-jwt-token-local",
        user: { id: "00000000-0000-4000-8000-000000000001" },
      }));

      // Seed valid token
      const validJwt = createMockJwt({ sub: "5196571f-b9ad-457c-b2e3-c07f13f6f1a3" });
      localStorage.setItem("valid_key", "unrelated_value");

      purgeCorruptedStorageTokens();

      expect(localStorage.getItem("sb-mqotnlflwrgqpbhjkwyq-auth-token")).toBeNull();
      expect(localStorage.getItem("valid_key")).toBe("unrelated_value");
    });
  });

  describe("getValidUploadAuth", () => {
    it("returns an authenticated compact JWS token and user ID", async () => {
      const auth = await getValidUploadAuth();
      expect(isCompactJWS(auth.token)).toBe(true);
      expect(typeof auth.userId).toBe("string");
      expect(auth.userId.length).toBeGreaterThan(0);
    });
  });
});
