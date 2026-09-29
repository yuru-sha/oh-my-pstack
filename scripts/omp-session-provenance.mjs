import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function inspectOmpSessionProvenance(jsonl) {
  const resolved = [];
  const assistantMessages = [];
  const modelUsage = [];

  for (const [index, line] of jsonl.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      throw new SyntaxError(`Invalid OMP session JSONL at line ${index + 1}`, {
        cause: error,
      });
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new SyntaxError(`Expected OMP session entry object at line ${index + 1}`);
    }

    if (entry.type === "model_change" && typeof entry.model === "string") {
      resolved.push({
        role: entry.role ?? "default",
        model: entry.model,
        fallback: typeof entry.resolvedModelIsFallback === "boolean"
          ? entry.resolvedModelIsFallback
          : null,
        timestamp: entry.timestamp ?? null,
      });
    }

    if (entry.type === "model_usage") {
      modelUsage.push({
        purpose: entry.purpose ?? null,
        role: entry.role ?? null,
        provider: entry.provider ?? null,
        model: entry.model ?? null,
        timestamp: entry.timestamp ?? null,
      });
    }

    const message = entry.type === "message" ? entry.message : null;
    if (
      message?.role === "assistant" &&
      typeof message.provider === "string" &&
      typeof message.model === "string"
    ) {
      assistantMessages.push({
        provider: message.provider,
        model: message.model,
        timestamp: entry.timestamp ?? null,
        usage: message.usage ?? null,
      });
    }
  }

  return { resolved, assistantMessages, modelUsage };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/omp-session-provenance.mjs <child-session.jsonl>");
    process.exitCode = 2;
    return;
  }

  const jsonl = await readFile(file, "utf8");
  console.log(JSON.stringify(inspectOmpSessionProvenance(jsonl), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
