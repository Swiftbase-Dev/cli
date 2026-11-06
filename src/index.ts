#!/usr/bin/env node

import { Command } from "commander";
import { loadSdk } from "./core/sdk";
import { loginAction } from "./commands/login";
import { listProjects, selectProject } from "./commands/project";
import { listContainersAction, deployAction, tailLogsAction } from "./commands/container";
import {
  listDatabasesAction,
  listTablesAction,
  queryAction,
  executeFileAction,
  executeAction,
  exportTableAction,
  importTableAction,
} from "./commands/db";
import {
  listBucketsAction,
  listObjectsAction,
  uploadAction,
  downloadAction,
} from "./commands/storage";
import {
  listConfigsAction,
  getConfigAction,
  createConfigAction,
  uploadConfigAction,
  downloadConfigAction,
  publishConfigAction,
  deleteConfigAction,
} from "./commands/config";
import {
  getVaultSecret,
  setVaultSecret,
  listVaultSecrets,
} from "./commands/vault";
import { generateAction, listPromptsAction } from "./commands/ai";

const program = new Command();

program
  .name("swiftbase")
  .description("Swiftbase CLI developer operations tool")
  .version("1.0.0");

// Load the SDK settings and tokens before executing actions
program.hook("preAction", () => {
  loadSdk();
});

// Authentication
program
  .command("login")
  .description("Login to Swiftbase account")
  .action(loginAction);

// Projects
const projectCmd = program.command("project").description("Manage developer projects");

projectCmd
  .command("list")
  .description("List associated projects")
  .action(listProjects);

projectCmd
  .command("select <projectId>")
  .description("Select active working project ID")
  .action((projectId) => {
    selectProject(projectId);
  });

// Containers
const containerCmd = program.command("container").description("Manage container deployments");

containerCmd
  .command("list")
  .description("List deployed containers in the active project")
  .action(listContainersAction);

containerCmd
  .command("deploy [dir]")
  .description("Build container locally and deploy it to Swiftbase")
  .action(async (dir) => {
    await deployAction(dir);
  });

containerCmd
  .command("logs <containerIdOrName>")
  .description("Tail logs from a deployed container by ID or Name")
  .option("-f, --follow", "Continuously tail container logs")
  .option("-l, --level <level>", "Filter logs by level (e.g. error, warn, info, debug)")
  .option("-n, --lines <lines>", "Number of initial lines to retrieve", "50")
  .action(async (containerIdOrName, options) => {
    await tailLogsAction(containerIdOrName, options);
  });

// Databases
const dbCmd = program.command("db").description("Manage and query project databases");

dbCmd
  .command("list")
  .description("List databases in the active project")
  .action(listDatabasesAction);

dbCmd
  .command("list-tables")
  .description("List tables in a database")
  .option("-d, --database <database>", "Database name or ID")
  .action(async (options) => {
    await listTablesAction(options);
  });

dbCmd
  .command("query <sqlOrFile>")
  .description("Execute a raw SQL query or SQL file against a database")
  .option("-d, --database <database>", "Database name or ID")
  .option("-f, --format <format>", "Output format: table, json, csv", "table")
  .option("--file", "Explicitly treat argument as a file path")
  .action(async (sqlOrFile, options) => {
    await queryAction(sqlOrFile, options);
  });

dbCmd
  .command("exec <sqlFile>")
  .description("Execute a SQL script file against a database")
  .option("-d, --database <database>", "Database name or ID")
  .option("-f, --format <format>", "Output format: table, json, csv", "table")
  .action(async (sqlFile, options) => {
    await executeFileAction(sqlFile, options);
  });

dbCmd
  .command("export <tableName>")
  .description("Export table data to CSV, JSON, or console stdout")
  .option("-d, --database <database>", "Database name or ID")
  .option("-o, --out <filePath>", "Output file path (.csv or .json)")
  .option("-f, --format <format>", "Export format: csv, json")
  .action(async (tableName, options) => {
    await exportTableAction(tableName, options);
  });

dbCmd
  .command("import <tableName> <filePath>")
  .description("Import data from a CSV or JSON file into a database table")
  .option("-d, --database <database>", "Database name or ID")
  .option("-f, --format <format>", "Source format: csv, json (auto-detected by extension if omitted)")
  .action(async (tableName, filePath, options) => {
    await importTableAction(tableName, filePath, options);
  });

dbCmd
  .command("execute <payloadJson>")
  .description("Execute query builder payload against a database")
  .option("-d, --database <database>", "Database name or ID")
  .option("-f, --format <format>", "Output format: table, json, csv", "table")
  .action(async (payloadJson, options) => {
    await executeAction(payloadJson, options);
  });

// Storage
const storageCmd = program.command("storage").description("Manage object storage spaces and files");

storageCmd
  .command("list")
  .description("List all storage buckets")
  .action(listBucketsAction);

storageCmd
  .command("ls")
  .description("List objects inside a storage bucket")
  .option("-b, --bucket <bucket>", "Storage bucket name")
  .option("-p, --prefix <prefix>", "Object prefix to filter")
  .action(async (options) => {
    await listObjectsAction(options);
  });

storageCmd
  .command("upload <file>")
  .description("Upload file to storage bucket")
  .option("-b, --bucket <bucket>", "Storage bucket name")
  .option("-d, --dest <destinationKey>", "Destination key / path inside bucket")
  .action(async (file, options) => {
    await uploadAction(file, options);
  });

storageCmd
  .command("download <key>")
  .description("Download file from storage bucket")
  .option("-b, --bucket <bucket>", "Storage bucket name")
  .option("-d, --dest <destinationPath>", "Destination local file path")
  .action(async (key, options) => {
    await downloadAction(key, options);
  });

// Configs
const configCmd = program.command("config").description("Manage project environment configurations (configs table)");

configCmd
  .command("list")
  .description("List configuration profiles in the active project")
  .action(listConfigsAction);

configCmd
  .command("get <nameOrId>")
  .description("Retrieve configuration contents by name or ID")
  .action(async (nameOrId) => {
    await getConfigAction(nameOrId);
  });

configCmd
  .command("create <name>")
  .description("Create a new configuration profile")
  .option("-d, --description <description>", "Description of the config profile")
  .option("-f, --file <envFile>", "Initial .env file to populate config with")
  .action(async (name, options) => {
    await createConfigAction(name, { description: options.description, envFile: options.file });
  });

configCmd
  .command("upload <nameOrId> <envFile>")
  .description("Upload and replace contents of a configuration profile from a .env file")
  .action(async (nameOrId, envFile) => {
    await uploadConfigAction(nameOrId, envFile);
  });

configCmd
  .command("download <nameOrId> <destFile>")
  .description("Download a configuration profile to a local .env file")
  .action(async (nameOrId, destFile) => {
    await downloadConfigAction(nameOrId, destFile);
  });

configCmd
  .command("publish <nameOrId>")
  .description("Publish a configuration version and optionally restart attached containers")
  .option("-m, --message <message>", "Commit / release message for this version")
  .option("-r, --restart", "Restart any running containers bound to this config")
  .action(async (nameOrId, options) => {
    await publishConfigAction(nameOrId, {
      message: options.message,
      restartContainers: Boolean(options.restart),
    });
  });

configCmd
  .command("delete <nameOrId>")
  .description("Permanently delete a configuration profile")
  .action(async (nameOrId) => {
    await deleteConfigAction(nameOrId);
  });

// Vault Secrets
const vaultCmd = program.command("vault").description("Manage encrypted project vault credentials");

vaultCmd
  .command("list")
  .description("List vault secret keys (values masked)")
  .action(listVaultSecrets);

vaultCmd
  .command("get <secretKey>")
  .description("Retrieve a value from the vault store")
  .action(async (secretKey) => {
    await getVaultSecret(secretKey);
  });

vaultCmd
  .command("set <secretKey> <secretValue>")
  .description("Add/update a vault secret value")
  .action(async (secretKey, secretValue) => {
    await setVaultSecret(secretKey, secretValue);
  });

// AI
const aiCmd = program.command("ai").description("Execute generative AI prompt instructions");

aiCmd
  .command("list")
  .description("List AI prompts defined in the active project")
  .action(listPromptsAction);

aiCmd
  .command("generate <prompt>")
  .description("Submit prompt and return model response")
  .requiredOption("-m, --model <model>", "Model to use for completion (e.g. gemini-3.5-flash)")
  .option("-t, --token-limit <tokens>", "Optional maximum tokens to generate (or --tokens)")
  .option("--tokens <tokens>", "Alias for --token-limit")
  .option("--bypass-guardrails", "Optional flag to bypass guardrails (authorized users only)")
  .action(async (prompt, options) => {
    await generateAction(prompt, {
      model: options.model,
      tokenLimit: options.tokenLimit || options.tokens,
      bypassGuardrails: Boolean(options.bypassGuardrails),
    });
  });

// Parse the arguments
program.parse(process.argv);
