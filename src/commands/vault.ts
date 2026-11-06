import { vault } from "swiftbase-admin-sdk";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";
import ora from "ora";

export async function getVaultSecret(secretKey: string): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  const spinner = ora(`Retrieving vault secret '${secretKey}'...`).start();
  try {
    const secret = await vault.getSecret(secretKey, projectId);
    if (!secret) {
      spinner.fail(`Vault secret '${secretKey}' not found.`);
      process.exit(1);
    }

    // Retrieve decrypted versions for this secret to obtain the latest value
    const versions = await vault.getSecretVersions(secret.id);
    if (versions && versions.length > 0) {
      spinner.succeed(`Retrieved secret '${secretKey}' (v${secret.currentVersion}):`);
      console.log(versions[0].value);
    } else {
      spinner.fail(`No version value found for secret '${secretKey}'.`);
      process.exit(1);
    }
  } catch (err: any) {
    spinner.fail(`Failed to fetch vault secret: ${err.message}`);
    process.exit(1);
  }
}

export async function setVaultSecret(secretKey: string, secretValue: string): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  const spinner = ora(`Saving secret '${secretKey}' to vault...`).start();
  try {
    const existing = await vault.getSecret(secretKey, projectId);
    if (existing) {
      // Update existing secret with a new version
      await vault.updateSecretValue(existing.id, secretValue);
      spinner.succeed(`Updated secret '${secretKey}' to version v${existing.currentVersion + 1}.`);
    } else {
      // Create new secret
      await vault.createSecret({
        projectId,
        key: secretKey,
        name: secretKey,
        value: secretValue,
      });
      spinner.succeed(`Successfully created secret '${secretKey}' in project ${formatter.bold(projectId)}.`);
    }
  } catch (err: any) {
    spinner.fail(`Failed to save secret to vault: ${err.message}`);
    process.exit(1);
  }
}

export async function listVaultSecrets(): Promise<void> {
  const store = ConfigStore.getInstance();
  const projectId = store.getProjectId();

  if (!projectId) {
    formatter.error("Active project ID is not set. Use 'swiftbase project select <projectId>'");
    process.exit(1);
  }

  const spinner = ora("Listing vault secret keys...").start();
  try {
    const secrets = await vault.getSecrets(projectId);
    spinner.succeed("Retrieved vault secrets list:");

    if (!secrets || secrets.length === 0) {
      formatter.info("No secrets found in this project.");
      return;
    }

    const rows = secrets.map((s) => [
      s.key,
      s.name,
      `v${s.currentVersion}`,
      s.updatedAt || s.createdAt || "N/A",
    ]);
    formatter.table(["Key", "Name", "Version", "Updated At"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list vault secrets: ${err.message}`);
    process.exit(1);
  }
}
