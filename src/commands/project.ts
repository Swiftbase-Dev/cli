import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";

export async function listProjects(): Promise<void> {
  try {
    const store = ConfigStore.getInstance();
    const token = store.getAccessToken();
    if (!token) {
      formatter.error("Please login first using 'swiftbase login'");
      process.exit(1);
    }

    const baseUrl = store.getBaseUrl();
    formatter.info("Fetching developer projects...");

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data: any = await res.json();
    const projectsList = Array.isArray(data) ? data : data?.data || [];

    if (projectsList.length === 0) {
      formatter.info("No projects found for current account.");
      return;
    }

    const currentProjectId = store.getProjectId();
    const rows = projectsList.map((p: any) => [
      p.id === currentProjectId ? `${p.id} *` : p.id,
      p.name || p.slug || "Untitled",
      p.slug || "N/A",
      p.tier || "free",
    ]);

    formatter.table(["Project ID", "Project Name", "Slug", "Plan Tier"], rows);
    if (currentProjectId) {
      formatter.info("(*) Active working project");
    }
  } catch (err: any) {
    formatter.error(`Failed to list projects: ${err.message}`);
    process.exit(1);
  }
}

export function selectProject(projectId: string): void {
  const store = ConfigStore.getInstance();
  store.save({ projectId });
  formatter.success(`Active working project set to: ${formatter.bold(projectId)}`);
}
