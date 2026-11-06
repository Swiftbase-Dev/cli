import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listConfigsAction,
  getConfigAction,
  createConfigAction,
  uploadConfigAction,
  downloadConfigAction,
  publishConfigAction,
  deleteConfigAction,
} from "../src/commands/config";
import { ConfigStore } from "../src/core/config-store";
import fs from "fs";

vi.mock("../src/core/config-store", () => {
  const mockStore = {
    getProjectId: vi.fn().mockReturnValue("test-project"),
    getBaseUrl: vi.fn().mockReturnValue("https://api.swiftbase.io"),
    getAccessToken: vi.fn().mockReturnValue("mock-token"),
  };
  return {
    ConfigStore: {
      getInstance: vi.fn().mockReturnValue(mockStore),
    },
  };
});

describe("CLI Config Commands (configs table)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list configurations for the active project", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "cfg_01",
          name: "production-env",
          description: "Main production variables",
          config: "PORT=8080\nNODE_ENV=production",
          updatedAt: "2026-01-01",
        },
      ],
    } as any);

    await listConfigsAction();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.swiftbase.io/api/configs?projectId=test-project",
      expect.objectContaining({
        headers: { Authorization: "Bearer mock-token" },
      })
    );
    global.fetch = originalFetch;
  });

  it("should retrieve configuration by name or id", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "cfg_01",
          name: "production-env",
          description: "Main production variables",
          config: "DATABASE_URL=postgres://...",
        },
      ],
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await getConfigAction("production-env");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL=postgres://..."));
    logSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it("should create a new configuration profile", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cfg_02",
        name: "staging-env",
        description: "Staging env",
      }),
    } as any);

    await createConfigAction("staging-env", { description: "Staging env" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.swiftbase.io/api/configs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectId: "test-project",
          name: "staging-env",
          description: "Staging env",
          config: "",
        }),
      })
    );
    global.fetch = originalFetch;
  });

  it("should upload a .env file to update config contents", async () => {
    const tempEnv = "/tmp/test.env";
    fs.writeFileSync(tempEnv, "SECRET_KEY=12345\nDEBUG=true");

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "cfg_01", name: "app-config" }],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cfg_01", config: "SECRET_KEY=12345\nDEBUG=true" }),
      } as any);

    await uploadConfigAction("app-config", tempEnv);
    expect(global.fetch).toHaveBeenLastCalledWith(
      "https://api.swiftbase.io/api/configs/cfg_01/data",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ config: "SECRET_KEY=12345\nDEBUG=true" }),
      })
    );

    try { fs.unlinkSync(tempEnv); } catch {}
    global.fetch = originalFetch;
  });

  it("should publish a configuration version", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "cfg_01", name: "app-config" }],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cfg_01", name: "app-config" }),
      } as any);

    await publishConfigAction("app-config", { message: "Release v1.2", restartContainers: true });
    expect(global.fetch).toHaveBeenLastCalledWith(
      "https://api.swiftbase.io/api/configs/cfg_01/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "Release v1.2", restartContainers: true }),
      })
    );
    global.fetch = originalFetch;
  });
});
