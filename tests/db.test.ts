import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryAction, exportTableAction, importTableAction } from "../src/commands/db";
import { db } from "swiftbase-admin-sdk";
import fs from "fs";

vi.mock("swiftbase-admin-sdk", () => {
  const mockExecuteSQL = vi.fn().mockResolvedValue([
    { id: 1, email: "developer@swiftbase.io" },
  ]);
  const mockExecuteBatch = vi.fn().mockResolvedValue([]);
  const mockDbClient = {
    executeSQL: mockExecuteSQL,
    executeBatch: mockExecuteBatch,
  };
  const mockDb = vi.fn().mockReturnValue(mockDbClient);
  return {
    db: mockDb,
  };
});

describe("DB Command Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should format and run SQL query utilizing executeSQL helper correctly", async () => {
    await queryAction("SELECT * FROM users;", { database: "prod_db", format: "json" });
    expect(db).toHaveBeenCalledWith("prod_db");
    const client = (db as any)("prod_db");
    expect(client.executeSQL).toHaveBeenCalledWith("SELECT * FROM users;");
  });

  it("should support exporting table records to json/csv", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await exportTableAction("users", { database: "prod_db", format: "json" });
    expect(db).toHaveBeenCalledWith("prod_db");
    const client = (db as any)("prod_db");
    expect(client.executeSQL).toHaveBeenCalledWith('SELECT * FROM "users"');
    logSpy.mockRestore();
  });

  it("should support importing records into a database table", async () => {
    const tempFile = "/tmp/swiftbase-test-import.json";
    fs.writeFileSync(tempFile, JSON.stringify([{ id: 2, email: "imported@swiftbase.io" }]));

    await importTableAction("users", tempFile, { database: "prod_db", format: "json" });
    const client = (db as any)("prod_db");
    expect(client.executeBatch).toHaveBeenCalled();

    try { fs.unlinkSync(tempFile); } catch {}
  });

  it("should resolve database name to ID when available", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "01M0FJXX83WM459XYFJRH0ZNMT", name: "cms-ben" }],
    } as any);

    await queryAction("SELECT 1;", { database: "cms-ben", format: "json" });
    expect(db).toHaveBeenCalledWith("01M0FJXX83WM459XYFJRH0ZNMT");
    fetchSpy.mockRestore();
  });
});
