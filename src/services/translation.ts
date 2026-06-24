import { LLMAdapter } from "./llm/adapter";
import { logger } from "./logger";
import type { TranslationAgent, LLMProvider, TranslationRecord } from "../types";

export interface TranslateInput {
  text: string;
  agent: TranslationAgent;
  provider: LLMProvider;
}

export interface TranslateOutput {
  content: string;
  usage: { promptTokens: number; completionTokens: number };
}

export async function translate(input: TranslateInput): Promise<TranslateOutput> {
  const adapter = new LLMAdapter(input.provider);

  const model = input.agent.config.model || input.provider.models[0] || "gpt-4o-mini";

  const result = await adapter.chat({
    model,
    messages: [
      { role: "system", content: input.agent.systemPrompt },
      { role: "user", content: input.text },
    ],
    temperature: input.agent.config.temperature,
    max_tokens: input.agent.config.maxTokens,
  });

  logger.info(
    `[翻译] 完成 agent="${input.agent.name}" model=${model} tokens=${result.usage?.completion_tokens ?? "?"}`
  );

  return {
    content: result.content,
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
    },
  };
}

export async function translateStream(
  input: TranslateInput,
  onChunk: (delta: string) => void,
  signal?: AbortSignal
): Promise<TranslateOutput> {
  const adapter = new LLMAdapter(input.provider);

  const model =
    input.agent.config.model || input.provider.models[0] || "gpt-4o-mini";

  let fullContent = "";

  const { usage } = await adapter.chatStream(
    {
      model,
      messages: [
        { role: "system", content: input.agent.systemPrompt },
        { role: "user", content: input.text },
      ],
      temperature: input.agent.config.temperature,
      max_tokens: input.agent.config.maxTokens,
    },
    (delta) => {
      fullContent += delta;
      onChunk(fullContent);
    },
    signal
  );

  logger.info(
    `[翻译] 流式完成 agent="${input.agent.name}" model=${model} chars=${fullContent.length} tokens=${usage?.completion_tokens ?? "?"}`
  );
  logger.info(`[翻译] 响应:\n  ${fullContent.slice(0, 500)}`);

  return {
    content: fullContent,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
    },
  };
}

export function createTranslationRecord(
  input: TranslateInput,
  output: TranslateOutput,
  latency: number
): TranslationRecord {
  return {
    id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: input.agent.id,
    agentName: input.agent.name,
    sourceText: input.text,
    translatedText: output.content,
    sourceLang: "auto",
    targetLang: "unknown",
    providerName: input.provider.name,
    model: input.agent.config.model || input.provider.models[0] || "unknown",
    latency,
    timestamp: Date.now(),
    isFavorite: false,
  };
}
