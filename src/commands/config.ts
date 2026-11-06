import fs from "fs";
import path from "path";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";
import ora from "ora";

interface ConfigEntity {
  id: string;
  name: string;
  description?: string;
  config?: string;
  tags?: string;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedVersion?: number;
}

export async function listConfigsAction(): Promise<void> {
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

  const spinner = ora("Fetching configurations...").start();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const configs: ConfigEntity[] = await res.json();
    spinner.succeed("Retrieved configurations successfully:");

    if (!configs || configs.length === 0) {
      formatter.info("No configurations found in this project.");
      return;
    }

    const rows = configs.map((c) => [
      c.name,
      c.id,
      c.description || "N/A",
      c.updatedAt || c.createdAt || "N/A",
    ]);

    formatter.table(["Config Name", "Config ID", "Description", "Last Updated"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list configurations: ${err.message}`);
    process.exit(1);
  }
}

export async function getConfigAction(idOrName: string): Promise<void> {
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

  const spinner = ora(`Fetching configuration '${idOrName}'...`).start();
  try {
    // List configs to resolve by name if not an ID
    const listRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const configs: ConfigEntity[] = await listRes.json();
    const config = configs.find((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

    if (!config) {
      spinner.fail(`Configuration '${idOrName}' not found in project ${projectId}.`);
      process.exit(1);
    }

    spinner.succeed(`Configuration: ${formatter.bold(config.name)} (${config.id})`);
    if (config.description) {
      formatter.info(`Description: ${config.description}`);
    }
    console.log("\n" + (config.config || "# (Empty configuration)"));
  } catch (err: any) {
    spinner.fail(`Failed to fetch configuration: ${err.message}`);
    process.exit(1);
  }
}

export async function createConfigAction(
  name: string,
  options: { description?: string; envFile?: string }
): Promise<void> {
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

  let initialConfig = "";
  if (options.envFile) {
    const resolvedPath = path.resolve(options.envFile);
    if (!fs.existsSync(resolvedPath)) {
      formatter.error(`File '${options.envFile}' does not exist.`);
      process.exit(1);
    }
    initialConfig = fs.readFileSync(resolvedPath, "utf-8");
  }

  const spinner = ora(`Creating configuration '${name}'...`).start();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        name,
        description: options.description || "",
        config: initialConfig,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const created: ConfigEntity = await res.json();
    spinner.succeed(`Successfully created configuration '${created.name}' (${formatter.bold(created.id)})`);
  } catch (err: any) {
    spinner.fail(`Failed to create configuration: ${err.message}`);
    process.exit(1);
  }
}

export async function uploadConfigAction(
  idOrName: string,
  envFile: string
): Promise<void> {
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

  const resolvedPath = path.resolve(envFile);
  if (!fs.existsSync(resolvedPath)) {
    formatter.error(`File '${envFile}' does not exist.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  const spinner = ora(`Updating configuration '${idOrName}' with contents of '${envFile}'...`).start();

  try {
    // Find config ID
    const listRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const configs: ConfigEntity[] = await listRes.json();
    const config = configs.find((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

    if (!config) {
      spinner.fail(`Configuration '${idOrName}' not found.`);
      process.exit(1);
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs/${encodeURIComponent(config.id)}/data`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: fileContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    spinner.succeed(`Successfully updated configuration '${config.name}' (${config.id}) from ${formatter.bold(envFile)}.`);
  } catch (err: any) {
    spinner.fail(`Failed to upload config: ${err.message}`);
    process.exit(1);
  }
}

export async function downloadConfigAction(
  idOrName: string,
  destFile: string
): Promise<void> {
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

  const resolvedPath = path.resolve(destFile);
  const spinner = ora(`Downloading configuration '${idOrName}' to '${destFile}'...`).start();

  try {
    const listRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const configs: ConfigEntity[] = await listRes.json();
    const config = configs.find((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

    if (!config) {
      spinner.fail(`Configuration '${idOrName}' not found.`);
      process.exit(1);
    }

    fs.writeFileSync(resolvedPath, config.config || "", "utf-8");
    spinner.succeed(`Configuration saved to: ${formatter.bold(resolvedPath)}`);
  } catch (err: any) {
    spinner.fail(`Failed to download config: ${err.message}`);
    process.exit(1);
  }
}

export async function publishConfigAction(
  idOrName: string,
  options: { message?: string; restartContainers?: boolean }
): Promise<void> {
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

  const spinner = ora(`Publishing new version for config '${idOrName}'...`).start();
  try {
    const listRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const configs: ConfigEntity[] = await listRes.json();
    const config = configs.find((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

    if (!config) {
      spinner.fail(`Configuration '${idOrName}' not found.`);
      process.exit(1);
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs/${encodeURIComponent(config.id)}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: options.message || "Published via Swiftbase CLI",
        restartContainers: Boolean(options.restartContainers),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    spinner.succeed(`Successfully published configuration '${config.name}' (${config.id})!`);
  } catch (err: any) {
    spinner.fail(`Failed to publish config: ${err.message}`);
    process.exit(1);
  }
}

export async function deleteConfigAction(idOrName: string): Promise<void> {
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

  const spinner = ora(`Deleting configuration '${idOrName}'...`).start();
  try {
    const listRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const configs: ConfigEntity[] = await listRes.json();
    const config = configs.find((c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase());

    if (!config) {
      spinner.fail(`Configuration '${idOrName}' not found.`);
      process.exit(1);
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/configs/${encodeURIComponent(config.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    spinner.succeed(`Successfully deleted configuration '${config.name}' (${config.id}).`);
  } catch (err: any) {
    spinner.fail(`Failed to delete config: ${err.message}`);
    process.exit(1);
  }
}
