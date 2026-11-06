import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadAction, listBucketsAction, listObjectsAction } from "../src/commands/storage";
import { Storage } from "swiftbase-admin-sdk";

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

vi.mock("swiftbase-admin-sdk", () => {
  const mockPutObject = vi.fn().mockResolvedValue({ success: true });
  const mockListBuckets = vi.fn().mockResolvedValue([{ name: "my-bucket", creationDate: "2026-01-01" }]);
  const mockListObjects = vi.fn().mockResolvedValue({ contents: [{ key: "test.txt", size: 1024 }] });
  const mockStorage = vi.fn().mockImplementation(() => ({
    putObject: mockPutObject,
    listBuckets: mockListBuckets,
    listObjects: mockListObjects,
  }));
  return {
    Storage: mockStorage,
  };
});

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("dummy data")),
  },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("dummy data")),
}));

describe("Storage Commands", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should list storage buckets", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "01M08BWQBN2SK499M27RZF4ETC",
          name: "cms-site-assets",
          region: "East US",
          cdnEnabled: 1,
          createdAt: "2026-01-01",
        },
      ],
    });

    await listBucketsAction();
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should list objects inside a bucket", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          key: "test.txt",
          size: 1024,
          modified: "2026-01-01",
        },
      ],
    });

    await listObjectsAction({ bucket: "my-bucket" });
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should upload file to bucket using S3 PUT object SDK method", async () => {
    await uploadAction("test.txt", { bucket: "my-bucket", dest: "remote-test.txt" });
    expect(Storage).toHaveBeenCalledWith({ bucket: "my-bucket" });
  });
});
