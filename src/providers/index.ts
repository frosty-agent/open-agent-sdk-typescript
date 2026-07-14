/**
 * LLM Provider Factory
 *
 * Creates the appropriate provider based on API type configuration.
 */

export type { ApiType, LLMProvider, CreateMessageParams, CreateMessageResponse, NormalizedMessageParam, NormalizedContentBlock, NormalizedTool, NormalizedResponseBlock } from './types.js'

export { AnthropicProvider } from './anthropic.js'
export { OpenAIProvider } from './openai.js'
export { OpenRouterProvider } from './openrouter.js'
export type { OpenRouterClient, OpenRouterChatResponse, OpenRouterProviderOptions } from './openrouter.js'

import type { ApiType, LLMProvider } from './types.js'
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'
import { OpenRouterProvider } from './openrouter.js'
import type { OpenRouterProviderOptions } from './openrouter.js'

/**
 * Create an LLM provider based on the API type.
 *
 * @param apiType - 'anthropic-messages', 'openai-completions', or 'openrouter'
 * @param opts - API credentials
 */
export function createProvider(
  apiType: ApiType,
  opts: { apiKey?: string; baseURL?: string } | OpenRouterProviderOptions,
): LLMProvider {
  switch (apiType) {
    case 'anthropic-messages':
      return new AnthropicProvider(opts)
    case 'openai-completions':
      return new OpenAIProvider(opts)
    case 'openrouter':
      return new OpenRouterProvider(opts)
    default:
      throw new Error(`Unsupported API type: ${apiType}. Use 'anthropic-messages', 'openai-completions', or 'openrouter'.`)
  }
}
