# Swiftbase CLI ("swiftbase") - Architectural Design Document

This document defines the architectural design, command structure, modules, and implementation patterns for the **Swiftbase CLI (`swiftbase`)**. The CLI is a developer-facing tool built with Node.js, TypeScript, and **Commander**. It enables customers to manage their projects, configure settings, upload storage objects, deploy containers, run database queries, and generate AI completions via `swiftbase-admin-sdk`.

---

## 1. Core Architectural Pillars

1. **KISS & DRY Principles:** Shared utilities for credential validation, formatting, file processing, and SDK loading.
2. **Beautiful & Interactive UX:** Utilizing `chalk` for custom palette styling, `ora` for progress animations, and `boxen` / `cli-table3` for output formatting.
3. **Robust Auth Flow:** Supporting standard browser OIDC logins via redirect, alongside local console-based backup flow for server terminals.
4. **Resiliency:** Handles network interruptions, streams large files in chunks, and gracefully exits with proper UNIX error codes.

---

## 2. Command Structure

```text
swiftbase
├── login                               # OIDC Authenticate CLI (browser-less fallback)
├── project
│   ├── list                            # List associated developer projects
│   └── select <projectId>              # Set active working project id
├── container
│   ├── deploy [dir]                    # Tarball directory, build using Docker, push to registry
│   └── logs <containerId>              # Tail container logs via WebSocket stream
├── db
│   ├── query <dbName> <sql>            # Run a raw SQL select/mutation query
│   └── execute <dbName> <payloadJson>  # Execute query via query payload syntax
├── storage
│   ├── list-buckets                    # List all storage spaces
│   ├── ls <bucket> [prefix]            # List files inside a bucket
│   ├── upload <bucket> <file> [dest]   # Multipart / chunked upload for large files
│   └── download <bucket> <key> [dest]  # Stream download files from bucket
├── config
│   ├── get                             # Fetch current project settings configuration
│   ├── upload <envFile>                # Upload a .env file as config settings
│   └── download <destFile>             # Download config structure as a .env formatted file
├── vault
│   ├── get <secretKey>                 # Retrieve vault secret value
│   ├── set <secretKey> <secretValue>   # Save/update a vault secret
│   └── list                            # List masked secret keys
└── ai
    └── generate <prompt>               # Execute a generative model completion prompt
```

---

## 3. Directory Layout

```text
cli/
├── src/
│   ├── commands/                       # Command action modules
│   │   ├── login.ts
│   │   ├── container.ts
│   │   ├── db.ts
│   │   ├── storage.ts
│   │   ├── config.ts
│   │   ├── vault.ts
│   │   └── ai.ts
│   ├── core/                           # System controllers and shared SDK loaders
│   │   ├── sdk.ts                      # Loads swiftbase-admin-sdk, injects auth config
│   │   ├── config-store.ts             # Stores tokens locally (e.g. in ~/.config/swiftbase/config.json)
│   │   └── formatter.ts                # ANSI styling, tables, animations helpers
│   ├── index.ts                        # Main cli runner entrypoint
│   └── types.ts
├── tests/                              # Vitest test files
│   ├── login.test.ts
│   ├── db.test.ts
│   └── storage.test.ts
├── DESIGN.md                           # Architectural Design Document
├── package.json
└── tsconfig.json
```

---

## 4. Subsystem Design & Technical Spec

### 4.1. Authentication ("login")
- **Browser Available:** Launches a local HTTP server (typically listening on port `3010`) and spawns the browser (`open` package) directing to: `${AUTH_BASE_URL}/oauth/authorize?redirect_uri=http://localhost:3010/callback`.
- **Browser-less (Server / CI):** Prints a URL to copy/paste. The URL includes a unique state code. The user authenticates in a browser on another machine and pastes the generated authorization code back into the CLI prompt.

### 4.2. Container Deployment ("container deploy")
1. **Archive:** Compresses the target directory into a `.tar.gz` archive in memory or temporary directory.
2. **Build & Push:** Uses the local Docker daemon to build the container (`docker buildx build`) using a retrieved temporary project registry token, then pushes the image directly to the project's private registry.
3. **Deploy:** Calls the internal deployment orchestrator API using `swiftbase-admin-sdk` to trigger container update rollout.

### 4.3. Storage Spaces ("storage upload/download")
- To prevent out-of-memory errors on large files, uploads use streams:
  ```typescript
  import fs from 'fs';
  import { Storage } from 'swiftbase-admin-sdk';
  
  // Large files are uploaded using pre-signed multipart uploads or chunked streams
  const storage = new Storage({ bucket });
  const fileStream = fs.createReadStream(filePath);
  // Upload stream via Admin SDK
  ```

### 4.4. Vault & Settings Configuration ("vault" & "config")
- Vault secrets are retrieved and set securely.
- Config settings upload parses `.env` files into a unified JSON dictionary:
  ```typescript
  import dotenv from 'dotenv';
  const configData = dotenv.parse(fs.readFileSync(envFilePath));
  await updateConfiguration(projectId, { data: configData });
  ```

---

## 5. Verification Plan

### Automated Unit Tests
Unit tests will be written in TypeScript and executed using Vitest.
```bash
# Run unit tests
npx vitest run
```

### Mocking Strategies
- **SDK Mocking:** Tests will mock `swiftbase-admin-sdk` network operations to verify correct command parsing, validation constraints, and output rendering.
- **FS Mocking:** Mock local filesystems when simulating `.env` configuration uploads or large file downloads.
