import fs from "fs";
import path from "path";
import { db } from "swiftbase-admin-sdk";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";
import { rowsToCsv, parseCsv } from "../core/csv";
import ora from "ora";

function renderQueryResults(rowsData: any[], format?: string): void {
  const normalizedFormat = format?.toLowerCase();

  if (normalizedFormat === "json") {
    console.log(JSON.stringify(rowsData, null, 2));
    return;
  }

  if (normalizedFormat === "csv") {
    console.log(rowsToCsv(rowsData));
    return;
  }

  // Default table formatting
  if (Array.isArray(rowsData) && rowsData.length > 0) {
    const columns = Object.keys(rowsData[0]);
    const rows = rowsData.map((row: any) =>
      columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      })
    );
    formatter.table(columns, rows);
  } else {
    formatter.success("Query executed successfully. 0 rows returned.");
  }
}

export async function listDatabasesAction(): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();
  const baseUrl = store.getBaseUrl();

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  if (!token) {
    formatter.error("Please login first using 'swiftbase login'");
    process.exit(1);
  }

  const spinner = ora("Fetching databases...").start();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/databases?projectId=${encodeURIComponent(projectId)}&stats=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list databases: HTTP ${res.status}`);
    }

    const dbs: any[] = await res.json();
    spinner.succeed("Retrieved databases successfully:");

    if (!dbs || dbs.length === 0) {
      formatter.info("No databases found in this project.");
      return;
    }

    const rows = dbs.map((d: any) => [
      d.name,
      d.id,
      d.engine || "oltp",
      d.type || "dev",
      String(d.stats?.totalTables ?? d.totalTables ?? 0),
      d.stats?.storageDisplay || "N/A",
      d.backupFrequency || "daily",
    ]);

    formatter.table(
      ["Database Name", "ID", "Engine", "Type", "Tables", "Storage", "Backup Frequency"],
      rows
    );
  } catch (err: any) {
    spinner.fail(`Failed to list databases: ${err.message}`);
    process.exit(1);
  }
}

export async function resolveDatabaseId(dbIdentifier: string): Promise<string> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();
  const baseUrl = store.getBaseUrl();

  // If already a 26-character alphanumeric ID, return as is
  if (/^[0-9A-Za-z]{26}$/.test(dbIdentifier)) {
    return dbIdentifier;
  }

  if (!projectId || !token) {
    return dbIdentifier;
  }

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/databases?projectId=${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-project-id": projectId,
        },
      }
    );

    if (res.ok) {
      const dbs: any[] = await res.json();
      const match = dbs.find(
        (d) => d.name === dbIdentifier || d.id === dbIdentifier
      );
      if (match) {
        return match.id;
      }
    }
  } catch {
    // If lookup fails, fallback to original identifier
  }

  return dbIdentifier;
}

export async function listTablesAction(options: { database?: string; dbname?: string }): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();
  const baseUrl = store.getBaseUrl();
  const rawDb = options.database || options.dbname;

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  if (!rawDb) {
    formatter.error("Database name or ID is required. Use '--database <dbname>' or '-d <dbname>'");
    process.exit(1);
  }

  if (!token) {
    formatter.error("Please login first using 'swiftbase login'");
    process.exit(1);
  }

  const dbId = await resolveDatabaseId(rawDb);
  const spinner = ora(`Fetching tables for database '${rawDb}'...`).start();
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/databases/tables?database=${encodeURIComponent(dbId)}&projectId=${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-project-id": projectId,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch tables: HTTP ${res.status}`);
    }

    const tables: any[] = await res.json();
    spinner.succeed(`Retrieved tables for database '${rawDb}':`);

    if (!tables || tables.length === 0) {
      formatter.info("No tables found in this database.");
      return;
    }

    const rows = tables.map((t: any) => [
      t.dbname,
      t.name || t.dbname,
      t.id,
      String(t.estimatedRecords ?? "0"),
      t.updatedAt || t.createdAt || "N/A",
    ]);

    formatter.table(["Table (DB Name)", "Friendly Name", "Table ID", "Records", "Last Modified"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list tables: ${err.message}`);
    process.exit(1);
  }
}

export async function queryAction(
  sqlOrFile: string,
  options: { database?: string; dbname?: string; format?: string; file?: boolean }
): Promise<void> {
  const rawDb = options.database || options.dbname;
  if (!rawDb) {
    formatter.error("Database name is required. Specify with '--database <name>' or '-d <name>'");
    process.exit(1);
  }

  const dbId = await resolveDatabaseId(rawDb);

  let sql = sqlOrFile;
  if (options.file || (!sql.trim().toUpperCase().startsWith("SELECT") &&
      !sql.trim().toUpperCase().startsWith("INSERT") &&
      !sql.trim().toUpperCase().startsWith("UPDATE") &&
      !sql.trim().toUpperCase().startsWith("DELETE") &&
      !sql.trim().toUpperCase().startsWith("CREATE") &&
      !sql.trim().toUpperCase().startsWith("ALTER") &&
      !sql.trim().toUpperCase().startsWith("DROP") &&
      fs.existsSync(path.resolve(sqlOrFile)))) {
    const resolvedPath = path.resolve(sqlOrFile);
    if (!fs.existsSync(resolvedPath)) {
      formatter.error(`SQL file '${sqlOrFile}' not found.`);
      process.exit(1);
    }
    sql = fs.readFileSync(resolvedPath, "utf-8");
  }

  formatter.info(`Executing SQL on database: ${formatter.bold(rawDb)}...`);
  try {
    const res = await db(dbId).executeSQL(sql);
    const rowsData = Array.isArray(res) ? res : res?.data || res?.results || [];
    renderQueryResults(rowsData, options.format);
  } catch (err: any) {
    formatter.error(`Query execution failed: ${err.message}`);
    process.exit(1);
  }
}

export async function executeFileAction(
  filePath: string,
  options: { database?: string; dbname?: string; format?: string }
): Promise<void> {
  const rawDb = options.database || options.dbname;
  if (!rawDb) {
    formatter.error("Database name is required. Specify with '--database <name>' or '-d <name>'");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    formatter.error(`File '${filePath}' does not exist.`);
    process.exit(1);
  }

  const sql = fs.readFileSync(resolved, "utf-8");
  await queryAction(sql, { ...options, file: false });
}

export async function executeAction(
  payloadJson: string,
  options: { database?: string; dbname?: string; format?: string }
): Promise<void> {
  const rawDb = options.database || options.dbname;
  if (!rawDb) {
    formatter.error("Database name is required. Specify with '--database <name>' or '-d <name>'");
    process.exit(1);
  }

  const dbId = await resolveDatabaseId(rawDb);
  formatter.info(`Executing Query payload on database: ${formatter.bold(rawDb)}...`);
  try {
    const payload = JSON.parse(payloadJson);
    const builder = db(dbId)(payload.table);
    if (payload.select) {
      builder.select(payload.select);
    }
    if (payload.where) {
      payload.where.forEach((w: any) => {
        builder.where(w.column, w.operator || "=", w.value);
      });
    }
    if (payload.limit) {
      builder.limit(payload.limit);
    }
    if (payload.offset) {
      builder.offset(payload.offset);
    }

    const res = await builder.execute();
    const rowsData = Array.isArray(res) ? res : res?.data || res?.results || [];
    renderQueryResults(rowsData, options.format);
  } catch (err: any) {
    formatter.error(`Payload execution failed: ${err.message}`);
    process.exit(1);
  }
}

export async function exportTableAction(
  tableName: string,
  options: { database?: string; dbname?: string; out?: string; format?: string }
): Promise<void> {
  const rawDb = options.database || options.dbname;
  if (!rawDb) {
    formatter.error("Database name is required. Specify with '--database <name>' or '-d <name>'");
    process.exit(1);
  }

  const dbId = await resolveDatabaseId(rawDb);
  const spinner = ora(`Exporting data from table '${tableName}' in database '${rawDb}'...`).start();
  try {
    const res = await db(dbId).executeSQL(`SELECT * FROM "${tableName}"`);
    const rowsData = Array.isArray(res) ? res : res?.data || res?.results || [];

    const format = (options.format || (options.out?.endsWith(".json") ? "json" : "csv")).toLowerCase();
    const outputContent = format === "json" ? JSON.stringify(rowsData, null, 2) : rowsToCsv(rowsData);

    if (options.out) {
      const outPath = path.resolve(options.out);
      fs.writeFileSync(outPath, outputContent, "utf-8");
      spinner.succeed(`Exported ${rowsData.length} records to ${formatter.bold(outPath)}`);
    } else {
      spinner.stop();
      console.log(outputContent);
    }
  } catch (err: any) {
    spinner.fail(`Failed to export table: ${err.message}`);
    process.exit(1);
  }
}

export async function importTableAction(
  tableName: string,
  filePath: string,
  options: { database?: string; dbname?: string; format?: string }
): Promise<void> {
  const rawDb = options.database || options.dbname;
  if (!rawDb) {
    formatter.error("Database name is required. Specify with '--database <name>' or '-d <name>'");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    formatter.error(`File '${filePath}' does not exist.`);
    process.exit(1);
  }

  const dbId = await resolveDatabaseId(rawDb);
  const spinner = ora(`Importing data from '${filePath}' into table '${tableName}'...`).start();
  try {
    const fileContent = fs.readFileSync(resolved, "utf-8");
    const format = (options.format || (filePath.endsWith(".json") ? "json" : "csv")).toLowerCase();

    let records: Record<string, any>[] = [];
    if (format === "json") {
      const parsed = JSON.parse(fileContent);
      records = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      records = parseCsv(fileContent);
    }

    if (records.length === 0) {
      spinner.warn("No records found in source file to import.");
      return;
    }

    // Insert batch using db(dbId).executeBatch or batch INSERT
    const columns = Object.keys(records[0]);
    const quotedCols = columns.map((c) => `"${c}"`).join(", ");

    const sqlStatements = records.map((rec) => {
      const values = columns
        .map((col) => {
          const val = rec[col];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "number" || typeof val === "boolean") return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        })
        .join(", ");
      return `INSERT OR REPLACE INTO "${tableName}" (${quotedCols}) VALUES (${values});`;
    });

    await db(dbId).executeBatch(sqlStatements);
    spinner.succeed(`Successfully imported ${records.length} records into table '${tableName}'.`);
  } catch (err: any) {
    spinner.fail(`Failed to import data: ${err.message}`);
    process.exit(1);
  }
}
