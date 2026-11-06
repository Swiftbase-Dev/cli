import fs from "fs";
import path from "path";
import { Storage } from "swiftbase-admin-sdk";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";
import mime from "mime-types";
import ora from "ora";

export async function listBucketsAction(): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  if (!token) {
    formatter.error("Please login first using 'swiftbase login'");
    process.exit(1);
  }

  const spinner = ora("Fetching storage buckets...").start();
  try {
    const baseUrl = store.getBaseUrl();
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/buckets?projectId=${encodeURIComponent(projectId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-project-id": projectId,
      },
    });

    if (!res.ok) {
      // Fall back to storage.listBuckets() if /api/buckets returns error
      const storage = new Storage({ bucket: "default" });
      const buckets = await storage.listBuckets();
      spinner.succeed("Retrieved storage buckets successfully:");
      if (!buckets || buckets.length === 0) {
        formatter.info("No storage buckets found for this project.");
        return;
      }
      formatter.table(
        ["Bucket Name", "Created At"],
        buckets.map((b) => [b.name, b.creationDate || "N/A"])
      );
      return;
    }

    const buckets: any[] = await res.json();
    spinner.succeed("Retrieved storage buckets successfully:");
    if (!buckets || buckets.length === 0) {
      formatter.info("No storage buckets found for this project.");
      return;
    }

    formatter.table(
      ["Bucket Name", "Bucket ID", "Region", "CDN", "Created At"],
      buckets.map((b) => [
        b.name,
        b.id || "N/A",
        b.region || "us-east-1",
        b.cdnEnabled ? "enabled" : "disabled",
        b.createdAt || "N/A",
      ])
    );
  } catch (err: any) {
    spinner.fail(`Failed to list buckets: ${err.message}`);
    process.exit(1);
  }
}

export async function listObjectsAction(options: { bucket?: string; prefix?: string }): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();
  const token = store.getAccessToken();

  const bucket = options.bucket;
  if (!bucket) {
    formatter.error("Bucket name is required. Specify with '--bucket <bucket>' or '-b <bucket>'");
    process.exit(1);
  }

  const spinner = ora(`Listing contents of bucket '${bucket}'...`).start();
  try {
    const baseUrl = store.getBaseUrl();
    const query = new URLSearchParams({ bucketId: bucket });
    if (options.prefix) query.append("path", options.prefix);

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/buckets/files?${query.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(projectId ? { "x-project-id": projectId } : {}),
      },
    });

    if (res.ok) {
      const items: any = await res.json();
      spinner.succeed(`Listed contents of bucket '${bucket}':`);
      const fileList = Array.isArray(items) ? items : (items.contents || items.files || []);
      if (!fileList || fileList.length === 0) {
        formatter.info("Bucket is empty or no matching objects found.");
        return;
      }
      const rows = fileList.map((obj: any) => {
        const key = obj.key || obj.name || "N/A";
        const sizeKb = obj.size !== undefined ? `${(Number(obj.size) / 1024).toFixed(2)} KB` : "N/A";
        const lastMod = obj.lastModified || obj.modified || "N/A";
        return [key, sizeKb, lastMod];
      });
      formatter.table(["Key / Path", "Size", "Last Modified"], rows);
      return;
    }

    // Fall back to SDK Storage
    const storage = new Storage({ bucket });
    const sdkRes = await storage.listObjects({ prefix: options.prefix });
    spinner.succeed(`Listed contents of bucket '${bucket}':`);

    if (!sdkRes.contents || sdkRes.contents.length === 0) {
      formatter.info("Bucket is empty or no matching objects found.");
      return;
    }

    const rows = sdkRes.contents.map((obj) => [
      obj.key,
      `${(obj.size / 1024).toFixed(2)} KB`,
      obj.lastModified || "N/A",
    ]);
    formatter.table(["Key / Path", "Size", "Last Modified"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list objects: ${err.message}`);
    process.exit(1);
  }
}

export async function uploadAction(
  filePath: string,
  options: { bucket?: string; dest?: string }
): Promise<void> {
  const bucket = options.bucket;
  if (!bucket) {
    formatter.error("Bucket name is required. Specify with '--bucket <bucket>' or '-b <bucket>'");
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    formatter.error(`Local file '${filePath}' does not exist.`);
    process.exit(1);
  }

  const spinner = ora(`Uploading ${path.basename(resolvedPath)} to bucket '${bucket}'...`).start();
  try {
    const storage = new Storage({ bucket });
    const fileContent = fs.readFileSync(resolvedPath);
    const contentType = mime.lookup(resolvedPath) || "application/octet-stream";
    const destKey = options.dest || path.basename(resolvedPath);

    await storage.putObject(destKey, fileContent, { contentType });
    spinner.succeed(`Successfully uploaded file to: ${formatter.bold(destKey)}`);
  } catch (err: any) {
    spinner.fail(`Upload failed: ${err.message}`);
    process.exit(1);
  }
}

export async function downloadAction(
  key: string,
  options: { bucket?: string; dest?: string }
): Promise<void> {
  const bucket = options.bucket;
  if (!bucket) {
    formatter.error("Bucket name is required. Specify with '--bucket <bucket>' or '-b <bucket>'");
    process.exit(1);
  }

  const destPath = path.resolve(options.dest || path.basename(key));
  const spinner = ora(`Downloading object '${key}' from bucket '${bucket}'...`).start();
  try {
    const storage = new Storage({ bucket });
    const res = await storage.getObject(key);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    spinner.succeed(`Successfully downloaded object to: ${formatter.bold(destPath)}`);
  } catch (err: any) {
    spinner.fail(`Download failed: ${err.message}`);
    process.exit(1);
  }
}
