import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const HTML_PATH = path.resolve(
  __dirname,
  "..",
  "server",
  "templates",
  "sso-bridge.html",
);
const HTML = readFileSync(HTML_PATH, "utf8");

function extractInlineScript(html: string): string {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("inline <script> tag not found in sso-bridge.html");
  return match[1];
}

const SCRIPT = extractInlineScript(HTML);
const HTML_WITHOUT_SCRIPT = HTML.replace(/<script>[\s\S]*?<\/script>/, "");

interface LocationCall {
  type: "replace" | "assign-href";
  url: string;
}

interface BridgeRun {
  calls: LocationCall[];
  storage: Record<string, string>;
  flushTimers: () => void;
  pendingTimerCount: () => number;
}

function runBridge(query: string): BridgeRun {
  const search = query.length === 0 || query.startsWith("?") ? query : `?${query}`;
  const dom = new JSDOM(HTML_WITHOUT_SCRIPT, {
    url: `https://torqueshed.example.com/sso/bridge${search}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & typeof globalThis & Record<string, any>;

  const calls: LocationCall[] = [];
  const storage: Record<string, string> = {};

  // jsdom ships a real Storage, but replacing it with a recording stub keeps
  // assertions trivial and avoids depending on jsdom's persistence semantics.
  Object.defineProperty(win, "localStorage", {
    configurable: true,
    value: {
      setItem(key: string, value: string) {
        storage[String(key)] = String(value);
      },
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(storage, key)
          ? storage[key]
          : null;
      },
      removeItem(key: string) {
        delete storage[key];
      },
      clear() {
        for (const k of Object.keys(storage)) delete storage[k];
      },
      key: () => null,
      length: 0,
    },
  });

  // jsdom's `window.location` is non-configurable and refuses to navigate to
  // custom-scheme URLs, so we swap every `window.location.*` reference in the
  // bridge script for a recording stub exposed on the window as `__navStub`.
  // The rewrite is intentionally narrow — we only touch the three lookups the
  // script actually uses (`.search`, `.replace(...)`, `.href = ...`).
  const navStub: Record<string, unknown> = {
    search,
    replace(url: unknown) {
      calls.push({ type: "replace", url: String(url) });
    },
  };
  Object.defineProperty(navStub, "href", {
    configurable: true,
    enumerable: true,
    get: () => `https://torqueshed.example.com/sso/bridge${search}`,
    set(value: unknown) {
      calls.push({ type: "assign-href", url: String(value) });
    },
  });
  win.__navStub = navStub;

  const rewritten = SCRIPT.replace(/window\.location/g, "window.__navStub");
  // Guard against the bridge gaining a bare `location.*` reference in the
  // future — if it does, this test must be updated to also stub it out so the
  // assertions cannot silently miss a real navigation.
  if (/(^|[^.\w])location\s*\./.test(rewritten)) {
    throw new Error(
      "sso-bridge.html now references `location` without the `window.` prefix; " +
        "update tests/ssoBridgeHtml.test.ts to stub it too.",
    );
  }

  const pendingTimers: Array<() => void> = [];
  win.setTimeout = ((fn: () => void) => {
    pendingTimers.push(fn);
    return pendingTimers.length as unknown as number;
  }) as typeof win.setTimeout;

  win.eval(rewritten);

  return {
    calls,
    storage,
    pendingTimerCount: () => pendingTimers.length,
    flushTimers: () => {
      const queued = pendingTimers.splice(0);
      for (const fn of queued) fn();
    },
  };
}

const TOKEN = "header.payload.signature";

describe("sso-bridge.html", () => {
  it("persists the token to localStorage under torqueshed_auth_token", () => {
    const run = runBridge(`token=${encodeURIComponent(TOKEN)}`);
    expect(run.storage.torqueshed_auth_token).toBe(TOKEN);
  });

  it("attempts the torqueshed:// deep link with the URL-encoded token", () => {
    const run = runBridge(`token=${encodeURIComponent(TOKEN)}`);
    const deepLink = run.calls.find((c) =>
      c.url.startsWith("torqueshed://sso?token="),
    );
    expect(deepLink).toBeDefined();
    expect(deepLink?.type).toBe("assign-href");
    expect(deepLink?.url).toBe(
      `torqueshed://sso?token=${encodeURIComponent(TOKEN)}`,
    );
  });

  it("falls back to /app?ssoToken=<token> after the deep-link timeout", () => {
    const run = runBridge(`token=${encodeURIComponent(TOKEN)}`);
    expect(run.pendingTimerCount()).toBe(1);
    run.flushTimers();
    const fallback = run.calls.find(
      (c) => c.type === "replace" && c.url.includes("ssoToken="),
    );
    expect(fallback).toBeDefined();
    expect(fallback?.url).toBe(
      `/app?ssoToken=${encodeURIComponent(TOKEN)}`,
    );
  });

  it("honours a safe internal redirect param when forming the web fallback", () => {
    const run = runBridge(
      `token=${encodeURIComponent(TOKEN)}&redirect=${encodeURIComponent(
        "/garage",
      )}`,
    );
    run.flushTimers();
    const fallback = run.calls.find(
      (c) => c.type === "replace" && c.url.includes("ssoToken="),
    );
    expect(fallback?.url).toBe(
      `/garage?ssoToken=${encodeURIComponent(TOKEN)}`,
    );
  });

  it("appends ssoToken with & when the redirect already has a query string", () => {
    const run = runBridge(
      `token=${encodeURIComponent(TOKEN)}&redirect=${encodeURIComponent(
        "/garage?vehicle=42",
      )}`,
    );
    run.flushTimers();
    const fallback = run.calls.find(
      (c) => c.type === "replace" && c.url.includes("ssoToken="),
    );
    expect(fallback?.url).toBe(
      `/garage?vehicle=42&ssoToken=${encodeURIComponent(TOKEN)}`,
    );
  });

  it("immediately redirects to /app when no token is present", () => {
    const run = runBridge("");
    expect(run.calls).toEqual([{ type: "replace", url: "/app" }]);
    expect(run.pendingTimerCount()).toBe(0);
    expect(run.storage.torqueshed_auth_token).toBeUndefined();
  });

  describe("hostile redirect values are coerced to /app", () => {
    const hostile = [
      "//evil.com",
      "//evil.com/path",
      "\\\\evil.com",
      "/\\evil.com",
      "https://evil.com",
      "http://evil.com",
      "javascript:alert(1)",
      "evil.com",
      "",
    ];

    for (const value of hostile) {
      it(`rejects redirect=${JSON.stringify(value)}`, () => {
        const run = runBridge(
          `token=${encodeURIComponent(TOKEN)}&redirect=${encodeURIComponent(value)}`,
        );
        run.flushTimers();
        const fallback = run.calls.find(
          (c) => c.type === "replace" && c.url.includes("ssoToken="),
        );
        expect(fallback?.url).toBe(
          `/app?ssoToken=${encodeURIComponent(TOKEN)}`,
        );
        // And nothing should ever have pointed at evil.com.
        for (const call of run.calls) {
          expect(call.url).not.toContain("evil.com");
        }
      });
    }
  });

  it("URL-encodes tokens that contain characters needing escaping", () => {
    const trickyToken = 'a.b+c/d=e&f"g<h>i';
    const run = runBridge(`token=${encodeURIComponent(trickyToken)}`);
    expect(run.storage.torqueshed_auth_token).toBe(trickyToken);
    const deepLink = run.calls.find((c) =>
      c.url.startsWith("torqueshed://sso?token="),
    );
    expect(deepLink?.url).toBe(
      `torqueshed://sso?token=${encodeURIComponent(trickyToken)}`,
    );
    run.flushTimers();
    const fallback = run.calls.find(
      (c) => c.type === "replace" && c.url.includes("ssoToken="),
    );
    expect(fallback?.url).toBe(
      `/app?ssoToken=${encodeURIComponent(trickyToken)}`,
    );
  });
});
