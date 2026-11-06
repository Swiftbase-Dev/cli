import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVaultSecret, setVaultSecret, listVaultSecrets } from "../src/commands/vault";
import { vault } from "swiftbase-admin-sdk";
import { ConfigStore } from "../src/core/config-store";

vi.mock("swiftbase-admin-sdk", () => ({
  vault: {
    getSecret: vi.fn(),
    getSecrets: vi.fn(),
    createSecret: vi.fn(),
    updateSecretValue: vi.fn(),
    getSecretVersions: vi.fn(),
  },
}));

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

describe("CLI Vault Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve a secret value and display it", async () => {
    vi.mocked(vault.getSecret).mockResolvedValueOnce({
      id: "sec-1",
      key: "STRIPE_KEY",
      name: "Stripe",
      projectId: "test-project",
      currentVersion: 1,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(vault.getSecretVersions).mockResolvedValueOnce([
      {
        id: "v-1",
        secretId: "sec-1",
        projectId: "test-project",
        version: 1,
        value: "sk_test_12345",
        createdById: "user-1",
        createdAt: "",
        updatedAt: "",
      },
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await getVaultSecret("STRIPE_KEY");

    expect(vault.getSecret).toHaveBeenCalledWith("STRIPE_KEY", "test-project");
    expect(vault.getSecretVersions).toHaveBeenCalledWith("sec-1");
    expect(logSpy).toHaveBeenCalledWith("sk_test_12345");
    logSpy.mockRestore();
  });

  it("should create new secret if not found when setting secret", async () => {
    vi.mocked(vault.getSecret).mockResolvedValueOnce(null);
    vi.mocked(vault.createSecret).mockResolvedValueOnce({
      id: "sec-2",
      key: "NEW_KEY",
      name: "NEW_KEY",
      projectId: "test-project",
      currentVersion: 1,
      createdAt: "",
      updatedAt: "",
    });

    await setVaultSecret("NEW_KEY", "super_secret");

    expect(vault.createSecret).toHaveBeenCalledWith({
      projectId: "test-project",
      key: "NEW_KEY",
      name: "NEW_KEY",
      value: "super_secret",
    });
  });

  it("should update secret version if already exists when setting secret", async () => {
    vi.mocked(vault.getSecret).mockResolvedValueOnce({
      id: "sec-1",
      key: "STRIPE_KEY",
      name: "Stripe",
      projectId: "test-project",
      currentVersion: 1,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(vault.updateSecretValue).mockResolvedValueOnce({
      id: "sec-1",
      key: "STRIPE_KEY",
      name: "Stripe",
      projectId: "test-project",
      currentVersion: 2,
      createdAt: "",
      updatedAt: "",
    });

    await setVaultSecret("STRIPE_KEY", "sk_test_67890");

    expect(vault.updateSecretValue).toHaveBeenCalledWith("sec-1", "sk_test_67890");
  });

  it("should list secrets for project", async () => {
    vi.mocked(vault.getSecrets).mockResolvedValueOnce([
      {
        id: "sec-1",
        key: "STRIPE_KEY",
        name: "Stripe",
        projectId: "test-project",
        currentVersion: 1,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
      },
    ]);

    await listVaultSecrets();

    expect(vault.getSecrets).toHaveBeenCalledWith("test-project");
  });
});
