import fs from "fs";
import path from "path";
import os from "os";

export interface ConfigData {
  accessToken?: string;
  projectId?: string;
  baseUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "swiftbase");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export class ConfigStore {
  private static instance: ConfigStore | null = null;
  private data: ConfigData = {};

  private constructor() {
    this.load();
  }

  public static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  public load(): ConfigData {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, "utf-8");
        this.data = JSON.parse(fileContent);
      } else {
        this.data = {};
      }
    } catch (err) {
      this.data = {};
    }
    return this.data;
  }

  public save(newData: Partial<ConfigData>): void {
    this.data = { ...this.data, ...newData };
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save CLI configuration:", err);
    }
  }

  public clear(): void {
    this.data = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
    } catch (err) {
      // ignore
    }
  }

  public getAccessToken(): string | undefined {
    return this.data.accessToken;
  }

  public getProjectId(): string | undefined {
    return this.data.projectId;
  }

  public getBaseUrl(): string {
    return this.data.baseUrl || process.env.SWIFTBASE_BASE_URL || "https://api.swiftbase.io";
  }

  public getIdentityUrl(): string {
    if (process.env.SWIFTBASE_IDENTITY_URL) {
      return process.env.SWIFTBASE_IDENTITY_URL;
    }
    const base = this.getBaseUrl();
    if (base.includes("api.swiftbase.io") || base.includes("app.swiftbase.io")) {
      return base.replace("api.swiftbase.io", "identity.swiftbase.io").replace("app.swiftbase.io", "identity.swiftbase.io");
    }
    return base;
  }
}
