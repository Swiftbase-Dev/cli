import { initializeSdk, setAccessToken } from "swiftbase-admin-sdk";
import { ConfigStore } from "./config-store";

/**
 * Loads the swiftbase-admin-sdk and pre-configures it with local config credentials.
 */
export function loadSdk(): void {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId() || "default";
  const baseUrl = store.getBaseUrl();
  const token = store.getAccessToken();

  initializeSdk(projectId, { baseUrl });
  if (token) {
    setAccessToken(token);
  }
}
