# Swiftbase CLI

The official command-line interface for the Swiftbase platform. Published to npm as `@swiftbaseio/cli`.

## Installation and Execution

Run without installing via `npx`:

```bash
npx @swiftbaseio/cli <command>
```

Install globally using `npm`:

```bash
npm install -g @swiftbaseio/cli
```

Once installed globally, access the tool using the `swiftbase` binary:

```bash
swiftbase --help
```

To target a local or custom API instance, set the environment variable:

```bash
export SWIFTBASE_BASE_URL=https://api.swiftbase.io
```

---

## Authentication

### Login

Authenticate your local terminal session with your Swiftbase account:

```bash
swiftbase login
```

This starts a local callback server on port `3010` and opens your default browser to complete the OAuth2 PKCE login flow. If your browser does not open automatically, copy the printed authorization link into any browser. Once authorized, the access token is saved locally to `~/.config/swiftbase/config.json`.

---

## Command Reference

### Projects

#### List Projects

List all projects associated with your account:

```bash
swiftbase project list
```

#### Select Active Project

Set the active project context used by other commands:

```bash
swiftbase project select <projectId>
```

Example:

```bash
swiftbase project select author-sites
```

---

### Containers

#### List Containers

List all deployed containers in the currently selected project:

```bash
swiftbase container list
```

#### Deploy Container

Package a directory into an archive, upload it, and trigger a deployment:

```bash
swiftbase container deploy [dir]
```

Arguments:

- `[dir]`: Directory containing application code and Dockerfile. Defaults to current directory (`.`).

Example:

```bash
swiftbase container deploy ./my-service
```

#### View Container Logs

Stream or read logs from a deployed container:

```bash
swiftbase container logs <containerIdOrName> [options]
```

Arguments:

- `<containerIdOrName>`: Container identifier or container name.

Options:

- `-f, --follow`: Stream new log entries continuously until interrupted with Ctrl+C.
- `-l, --level <level>`: Filter logs by level (`error`, `warn`, `info`, `debug`).
- `-n, --lines <lines>`: Number of initial log lines to fetch. Default is `50`.

Examples:

```bash
swiftbase container logs 01KXZY66XSN82HC0D7HHG8PV0Y
swiftbase container logs "SBCMS - Ben" --follow
swiftbase container logs "SBCMS - Ben" --level error --lines 100
```

---

### Databases

#### List Databases

List all databases in the active project:

```bash
swiftbase db list
```

#### List Tables

List tables within a specified database:

```bash
swiftbase db list-tables [options]
```

Options:

- `-d, --database <database>`: Target database name or database ID.

Example:

```bash
swiftbase db list-tables -d main_db
```

#### Run SQL Query

Execute an arbitrary SQL query or run a SQL file:

```bash
swiftbase db query <sqlOrFile> [options]
```

Arguments:

- `<sqlOrFile>`: SQL statement string or path to a `.sql` file.

Options:

- `-d, --database <database>`: Target database name or database ID.
- `-f, --format <format>`: Output format (`table`, `json`, `csv`). Default is `table`.
- `--file`: Explicitly treat the argument as a file path.

Examples:

```bash
swiftbase db query "SELECT * FROM users LIMIT 10" -d main_db
swiftbase db query "SELECT id, email FROM users" -d main_db -f json
swiftbase db query schema.sql -d main_db --file
```

#### Execute SQL File

Execute a SQL script file against a database:

```bash
swiftbase db exec <sqlFile> [options]
```

Arguments:

- `<sqlFile>`: Path to `.sql` script file.

Options:

- `-d, --database <database>`: Target database name or database ID.
- `-f, --format <format>`: Output format (`table`, `json`, `csv`). Default is `table`.

Example:

```bash
swiftbase db exec ./migrations/001_init.sql -d main_db
```

#### Export Table Data

Export rows from a database table:

```bash
swiftbase db export <tableName> [options]
```

Arguments:

- `<tableName>`: Name of table to export.

Options:

- `-d, --database <database>`: Target database name or database ID.
- `-o, --out <filePath>`: Destination file path.
- `-f, --format <format>`: Output format (`csv`, `json`).

Examples:

```bash
swiftbase db export users -d main_db -o ./users_backup.json
swiftbase db export orders -d main_db -o ./orders.csv -f csv
```

#### Import Table Data

Import rows from a CSV or JSON file into a database table:

```bash
swiftbase db import <tableName> <filePath> [options]
```

Arguments:

- `<tableName>`: Target table name.
- `<filePath>`: Path to local data file.

Options:

- `-d, --database <database>`: Target database name or database ID.
- `-f, --format <format>`: Input format (`csv`, `json`). If omitted, detected by file extension.

Example:

```bash
swiftbase db import users ./users_seed.json -d main_db
```

#### Execute Query Builder Payload

Execute structured query JSON against a database:

```bash
swiftbase db execute <payloadJson> [options]
```

Arguments:

- `<payloadJson>`: Raw JSON string matching query builder structure.

Options:

- `-d, --database <database>`: Target database name or database ID.
- `-f, --format <format>`: Output format (`table`, `json`, `csv`). Default is `table`.

Example:

```bash
swiftbase db execute '{"table":"users","action":"select","limit":5}' -d main_db
```

---

### Storage

#### List Buckets

List all storage buckets available in the project:

```bash
swiftbase storage list
```

#### List Bucket Contents

List files and prefixes in a bucket:

```bash
swiftbase storage ls [options]
```

Options:

- `-b, --bucket <bucket>`: Storage bucket name.
- `-p, --prefix <prefix>`: Filter objects by path prefix.

Examples:

```bash
swiftbase storage ls -b assets
swiftbase storage ls -b assets -p uploads/2026/
```

#### Upload File

Upload a local file into a storage bucket:

```bash
swiftbase storage upload <file> [options]
```

Arguments:

- `<file>`: Path to the local file to upload.

Options:

- `-b, --bucket <bucket>`: Storage bucket name.
- `-d, --dest <destinationKey>`: Target object path inside the bucket. If omitted, uses local filename.

Example:

```bash
swiftbase storage upload ./document.pdf -b assets -d docs/document.pdf
```

#### Download File

Download a file from a storage bucket:

```bash
swiftbase storage download <key> [options]
```

Arguments:

- `<key>`: Storage key of object in the bucket.

Options:

- `-b, --bucket <bucket>`: Storage bucket name.
- `-d, --dest <destinationPath>`: Local destination path. If omitted, saves to current directory.

Example:

```bash
swiftbase storage download docs/document.pdf -b assets -d ./downloads/document.pdf
```

---

### Configurations

#### List Configurations

List configuration profiles for the active project:

```bash
swiftbase config list
```

#### Get Configuration

Display variables stored in a configuration profile:

```bash
swiftbase config get <nameOrId>
```

Arguments:

- `<nameOrId>`: Configuration profile name or ID.

Example:

```bash
swiftbase config get production-env
```

#### Create Configuration

Create a new configuration profile:

```bash
swiftbase config create <name> [options]
```

Arguments:

- `<name>`: Unique name for configuration profile.

Options:

- `-d, --description <description>`: Optional description for the profile.
- `-f, --file <envFile>`: Path to a `.env` file to initialize key-value pairs.

Example:

```bash
swiftbase config create staging-env -d "Staging variables" -f ./staging.env
```

#### Upload Configuration File

Replace the content of an existing configuration profile using a `.env` file:

```bash
swiftbase config upload <nameOrId> <envFile>
```

Arguments:

- `<nameOrId>`: Configuration name or ID.
- `<envFile>`: Path to local `.env` file.

Example:

```bash
swiftbase config upload production-env ./.env.production
```

#### Download Configuration File

Export a configuration profile to a local `.env` file:

```bash
swiftbase config download <nameOrId> <destFile>
```

Arguments:

- `<nameOrId>`: Configuration name or ID.
- `<destFile>`: Output `.env` file path.

Example:

```bash
swiftbase config download production-env ./.env.downloaded
```

#### Publish Configuration Version

Create an immutable version snapshot of a configuration profile and optionally restart dependent containers:

```bash
swiftbase config publish <nameOrId> [options]
```

Arguments:

- `<nameOrId>`: Configuration name or ID.

Options:

- `-m, --message <message>`: Release notes or changelog message for this version.
- `-r, --restart`: Restart containers currently bound to this configuration profile.

Example:

```bash
swiftbase config publish production-env -m "Rotate third party api secrets" -r
```

#### Delete Configuration Profile

Permanently remove a configuration profile:

```bash
swiftbase config delete <nameOrId>
```

Arguments:

- `<nameOrId>`: Configuration name or ID.

---

### Vault Secrets

#### List Vault Secret Keys

List all encrypted vault secret keys registered in the project:

```bash
swiftbase vault list
```

Values remain masked in the list view for security.

#### Get Vault Secret Value

Retrieve a specific secret value:

```bash
swiftbase vault get <secretKey>
```

Arguments:

- `<secretKey>`: Name of secret key.

Example:

```bash
swiftbase vault get STRIPE_SECRET_KEY
```

#### Set Vault Secret

Add or update a key-value secret:

```bash
swiftbase vault set <secretKey> <secretValue>
```

Arguments:

- `<secretKey>`: Key identifier.
- `<secretValue>`: Secret value to encrypt and store.

Example:

```bash
swiftbase vault set STRIPE_SECRET_KEY sk_live_xyz123
```

---

### AI Completions & Prompts

#### List AI Prompts

List all saved prompt templates in the active project:

```bash
swiftbase ai list
```

#### Generate Completion

Send a prompt to a supported model and return the generated text:

```bash
swiftbase ai generate "<prompt>" [options]
```

Arguments:

- `<prompt>`: Text prompt string.

Options:

- `-m, --model <model>`: **Required**. Model to use for generation.
- `-t, --token-limit <tokens>`: Maximum tokens to generate (alias: `--tokens <tokens>`).
- `--tokens <tokens>`: Alias for `--token-limit`.
- `--bypass-guardrails`: Bypass project safety guardrails (requires editor permissions).

Examples:

```bash
swiftbase ai generate "Explain binary search in two sentences." -m chatgpt-6
swiftbase ai generate "Write a health check endpoint in Fastify." -m claude-5-5-sonnet-latest --tokens 200
swiftbase ai generate "Summarize system logs." -m gemini-4-flash --bypass-guardrails
```

#### Supported AI Models

- **Google**:
  - `gemini-4-ultra`
  - `gemini-4-pro`
  - `gemini-4-flash`
  - `gemini-4-flash-lite`
  - `gemini-3.8-pro`
  - `gemini-3.8-flash`
  - `gemini-3.7-pro`
  - `gemini-3.7-flash`
  - `gemini-3.6-pro`
  - `gemini-3.6-flash`
  - `gemini-3.5-flash-lite`
- **OpenAI**:
  - `chatgpt-6.1`
  - `chatgpt-6`
- **Anthropic**:
  - `claude-5-5-opus-latest`
  - `claude-5-5-sonnet-latest`
  - `claude-5-5-haiku-latest`
  - `claude-4-7-opus-latest`
  - `claude-4-7-sonnet-latest`
  - `claude-4-6-sonnet-latest`
  - `claude-4-6-haiku-latest`
- **Open Weight**:
  - `gemma-4-31b-it`
  - `gemma-4-9b-it`
  - `deepseek-r1`
  - `deepseek-r1-distill-llama-70b`
  - `llama3.3-70b-instruct`
  - `llama-3.2-3b-instruct`
  - `qwen2.5-coder-32b-instruct`
