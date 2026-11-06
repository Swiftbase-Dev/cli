import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectProject } from "../src/commands/project";
import { ConfigStore } from "../src/core/config-store";

vi.mock("../src/core/config-store", () => {
  const mockSave = vi.fn();
  const mockGet = vi.fn().mockReturnValue("test-project");
  return {
    ConfigStore: {
      getInstance: vi.fn().mockImplementation(() => ({
        save: mockSave,
        getProjectId: mockGet
      }))
    }
  };
});

describe("Project CLI Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully set selected project ID", () => {
    selectProject("my-cool-project");
    const store = ConfigStore.getInstance();
    expect(store.save).toHaveBeenCalledWith({ projectId: "my-cool-project" });
  });
});
