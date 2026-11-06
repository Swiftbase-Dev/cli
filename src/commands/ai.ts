import { ai } from "swiftbase-admin-sdk";
import { formatter } from "../core/formatter";
import ora from "ora";

export interface AIModelGroup {
  provider: string;
  models: string[];
}

export const AVAILABLE_AI_MODELS: AIModelGroup[] = [
  {
    provider: "Google",
    models: [
      "gemini-4-ultra",
      "gemini-4-pro",
      "gemini-4-flash"
    ]
  },
  {
    provider: "OpenAI",
    models: [
      "chatgpt-6.1",
      "chatgpt-6",
      "gpt-5",
      "gpt-5-mini",
      "o3",
      "o3-mini"
    ]
  },
  {
    provider: "Anthropic",
    models: [
      "claude-5-5-opus-latest",
      "claude-5-5-sonnet-latest",
      "claude-5-5-haiku-latest",
      "claude-3-7-sonnet-latest"
    ]
  },
  {
    provider: "DigitalOcean (Open Source)",
    models: [
      "deepseek-r1",
      "deepseek-r1-distill-llama-70b",
      "llama3.3-70b-instruct",
      "llama-3.2-3b-instruct",
      "qwen2.5-coder-32b-instruct"
    ]
  }
];

export const ALL_SUPPORTED_MODEL_IDS: string[] = AVAILABLE_AI_MODELS.flatMap(g => g.models);

export interface GenerateOptions {
  model: string;
  tokenLimit?: string | number;
  tokens?: string | number;
  maxTokens?: string | number;
  bypassGuardrails?: boolean;
}

export async function generateAction(prompt: string, options: GenerateOptions): Promise<void> {
  if (!options?.model) {
    formatter.error("Missing required parameter: --model <model>");
    process.exit(1);
  }

  const requestedModel = options.model.trim();
  const isSupported = ALL_SUPPORTED_MODEL_IDS.some(
    (m) => m.toLowerCase() === requestedModel.toLowerCase()
  );

  if (!isSupported) {
    formatter.error(
      `Unsupported AI model: '${requestedModel}'.\nSupported models:\n${AVAILABLE_AI_MODELS.map(
        (g) => `  ${g.provider}:\n` + g.models.map((m) => `    - ${m}`).join("\n")
      ).join("\n")}`
    );
    process.exit(1);
  }

  const tokenLimitRaw = options.tokenLimit ?? options.tokens ?? options.maxTokens;
  const maxTokens = tokenLimitRaw !== undefined ? parseInt(String(tokenLimitRaw), 10) : undefined;
  if (tokenLimitRaw !== undefined && (isNaN(maxTokens!) || maxTokens! <= 0)) {
    formatter.error("Invalid token limit specified. Must be a positive integer.");
    process.exit(1);
  }

  const spinner = ora(`Querying Swiftbase model (${options.model})...`).start();
  try {
    const res = await ai.chat.completions.create({
      model: options.model,
      max_tokens: maxTokens,
      bypass_guardrails: Boolean(options.bypassGuardrails),
      bypassGuardrails: Boolean(options.bypassGuardrails),
      messages: [
        {
          role: "system",
          content: "You are a helpful software engineering assistant helper."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    spinner.succeed("Prompt execution completed:");
    const outputText = res.choices?.[0]?.message?.content || "No output returned.";
    console.log(outputText);
  } catch (err: any) {
    const errorDetails = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err));
    spinner.fail(`AI Completion request failed: ${errorDetails}`);
    process.exit(1);
  }
}

export async function listPromptsAction(): Promise<void> {
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

  const spinner = ora("Fetching AI prompts...").start();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/ai/prompts?projectId=${encodeURIComponent(projectId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list prompts: HTTP ${res.status}`);
    }

    const data: any = await res.json();
    const prompts = Array.isArray(data) ? data : data?.data || [];
    spinner.succeed("Retrieved AI prompts successfully:");

    if (prompts.length === 0) {
      formatter.info("No AI prompts found for this project.");
      return;
    }

    const rows = prompts.map((p: any) => [
      p.name || "Untitled",
      p.id,
      p.model || "gemini-3.5-flash",
      p.updatedAt || p.createdAt || "N/A",
    ]);

    formatter.table(["Prompt Name", "ID", "Model", "Updated At"], rows);
  } catch (err: any) {
    spinner.fail(`Failed to list AI prompts: ${err.message}`);
    process.exit(1);
  }
}
