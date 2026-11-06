import fs from "fs";
import path from "path";
import os from "os";
import tar from "tar";
import ora from "ora";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";

export async function deployAction(dir: string = "."): Promise<void> {
  const spinner = ora("Preparing deployment archive...").start();
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();
  const baseUrl = store.getBaseUrl();

  if (!projectId) {
    spinner.fail("Active project is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  if (!token) {
    spinner.fail("Please login first using 'swiftbase login'");
    process.exit(1);
  }

  const targetDir = path.resolve(dir);
  if (!fs.existsSync(targetDir)) {
    spinner.fail(`Directory '${dir}' does not exist.`);
    process.exit(1);
  }

  const tempTarPath = path.join(os.tmpdir(), `swiftbase-build-${Date.now()}.tar.gz`);

  try {
    // Tar target directory
    await tar.c(
      {
        gzip: true,
        file: tempTarPath,
        cwd: targetDir,
      },
      ["."]
    );

    spinner.text = "Uploading archive to Swiftbase Container Deploy API...";

    const archiveBuffer = fs.readFileSync(tempTarPath);
    const containerName = path.basename(targetDir) || "app";

    // Use multipart/form-data via native Blob/FormData
    const formData = new FormData();
    const fileBlob = new Blob([archiveBuffer], { type: "application/gzip" });
    formData.append("file", fileBlob, "archive.tar.gz");
    formData.append("name", containerName);
    formData.append("domain", `${containerName}-${projectId}.swiftbase.app`);
    formData.append("projectId", projectId);
    formData.append("port", "80");

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/containers/deploy-archive`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    try { fs.unlinkSync(tempTarPath); } catch {}

    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try {
        const errJson: any = await res.json();
        errText = errJson.message || errText;
      } catch {}
      spinner.fail(`Deployment failed: ${errText}`);
      process.exit(1);
    }

    const deployRes: any = await res.json();
    spinner.succeed(`Archive uploaded and deployment scheduled!`);
    formatter.info(`Container: ${formatter.bold(deployRes.container?.name || containerName)} (ID: ${deployRes.container?.id || deployRes.containerId || "queued"})`);
    if (deployRes.container?.domain) {
      formatter.info(`Domain: https://${deployRes.container.domain}`);
    }
  } catch (err: any) {
    spinner.fail(`Deployment failed: ${err.message}`);
    try { fs.unlinkSync(tempTarPath); } catch {}
    process.exit(1);
  }
}

export interface TailLogsOptions {
  follow?: boolean;
  level?: string;
  lines?: string;
}

export async function tailLogsAction(containerIdOrName: string, options: TailLogsOptions = {}): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();
  const baseUrl = store.getBaseUrl();

  if (!projectId) {
    formatter.error("Active project is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  if (!token) {
    formatter.error("Please login first using 'swiftbase login'");
    process.exit(1);
  }

  formatter.info(`Fetching logs for container ${formatter.bold(containerIdOrName)} in project ${formatter.bold(projectId)}...`);

  const seenLogKeys = new Set<string>();
  const limit = options.lines ? String(options.lines) : "50";

  const fetchLogs = async (currentLimit: string): Promise<any[]> => {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/monitoring/logs`);
    url.searchParams.append("projectId", projectId);
    url.searchParams.append("entities", containerIdOrName);
    url.searchParams.append("limit", currentLimit);
    if (options.level) {
      url.searchParams.append("levels", options.level);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch logs: HTTP ${res.status}`);
    }

    const logs: any = await res.json();
    return Array.isArray(logs) ? logs : logs?.logs || logs?.data || [];
  };

  const printEntries = (logEntries: any[]) => {
    // Sort oldest first for console output
    const sorted = [...logEntries].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    sorted.forEach((entry: any) => {
      const ts = entry.timestamp || entry.createdAt || new Date().toISOString();
      const level = (entry.level || (entry.stream === "stderr" ? "ERROR" : "INFO")).toUpperCase();
      const msg = entry.message || entry.log || JSON.stringify(entry);
      const uniqueKey = `${ts}|${level}|${msg}`;

      if (!seenLogKeys.has(uniqueKey)) {
        seenLogKeys.add(uniqueKey);
        console.log(`[${ts}] [${level}] ${msg}`);
      }
    });
  };

  try {
    const initialEntries = await fetchLogs(limit);

    if (initialEntries.length === 0 && !options.follow) {
      formatter.info("No log entries found for this container.");
      return;
    }

    printEntries(initialEntries);

    if (options.follow) {
      formatter.info(`Tailing logs continuously (Press Ctrl+C to stop)...`);

      let running = true;
      const cleanup = () => {
        running = false;
        process.exit(0);
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      while (running) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const newEntries = await fetchLogs("100");
          printEntries(newEntries);
        } catch (pollErr: any) {
          // Keep attempting in follow mode unless aborted
        }
      }
    }
  } catch (err: any) {
    formatter.error(`Log fetch error: ${err.message}`);
    process.exit(1);
  }
}

export async function listContainersAction(): Promise<void> {
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

  const spinner = ora("Fetching containers...").start();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/containers?projectId=${encodeURIComponent(projectId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list containers: HTTP ${res.status}`);
    }

    const containers: any[] = await res.json();
    spinner.succeed("Retrieved containers successfully:");

    if (!containers || containers.length === 0) {
      formatter.info("No containers deployed in this project.");
      return;
    }

    const rows = containers.map((c: any) => {
      let formattedDomain = "N/A";
      if (c.domain) {
        let domainStr = c.domain;
        if (!domainStr.includes(".")) {
          domainStr = `${domainStr}.${projectId}.swiftbase.app`;
        }
        formattedDomain = domainStr.startsWith("http") ? domainStr : `https://${domainStr}`;
      }

      return [
        c.name,
        c.id,
        c.status || "UNKNOWN",
        formattedDomain,
        c.image || "N/A",
        `${c.cpu || 0.5} CPU / ${c.memory || "512mb"}`,
      ];
    });

    formatter.table(["Container Name", "ID", "Status", "Domain", "Image", "Resources"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list containers: ${err.message}`);
    process.exit(1);
  }
}
