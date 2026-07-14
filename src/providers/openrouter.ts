/**
 * OpenRouter native SDK provider.
 *
 * This deliberately uses the official @openrouter/sdk client rather than an
 * OpenAI-compatible HTTP endpoint. The small client interface is exported so
 * callers and tests can inject a transport without credentials or network I/O.
 */

import { OpenRouter } from '@openrouter/sdk'
import type {
  CreateMessageParams,
  CreateMessageResponse,
  LLMProvider,
  NormalizedMessageParam,
} from './types.js'

export interface OpenRouterChatResponse {
  choices: Array<{
    finishReason: string | null
    message: { content?: string | null }
  }>
  usage?: {
    promptTokens: number
    completionTokens: number
    cost?: number | null
  }
}

export interface OpenRouterClient {
  chat: {
    send(request: {
      chatRequest: {
        model: string
        maxTokens: number
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
        stream: false
      }
    }): Promise<OpenRouterChatResponse>
  }
}

export interface OpenRouterProviderOptions {
  apiKey?: string
  baseURL?: string
  client?: OpenRouterClient
}

export class OpenRouterProvider implements LLMProvider {
  readonly apiType = 'openrouter' as const
  private client: OpenRouterClient

  constructor(opts: OpenRouterProviderOptions = {}) {
    this.client = opts.client ?? new OpenRouter({
      apiKey: opts.apiKey,
      serverURL: opts.baseURL,
    })
  }

  async createMessage(params: CreateMessageParams): Promise<CreateMessageResponse> {
    const response = await this.client.chat.send({
      chatRequest: {
        model: params.model,
        maxTokens: params.maxTokens,
        messages: this.convertMessages(params.system, params.messages),
        stream: false,
      },
    })
    const choice = response.choices[0]

    return {
      content: [{ type: 'text', text: choice?.message.content ?? '' }],
      stopReason: this.mapFinishReason(choice?.finishReason),
      usage: {
        input_tokens: response.usage?.promptTokens ?? 0,
        output_tokens: response.usage?.completionTokens ?? 0,
        cost: response.usage?.cost ?? undefined,
      },
    }
  }

  private convertMessages(
    system: string,
    messages: NormalizedMessageParam[],
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const result: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (system) result.push({ role: 'system', content: system })

    for (const message of messages) {
      result.push({
        role: message.role,
        content: typeof message.content === 'string'
          ? message.content
          : message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n'),
      })
    }
    return result
  }

  private mapFinishReason(reason: string | null | undefined): string {
    switch (reason) {
      case 'stop': return 'end_turn'
      case 'length': return 'max_tokens'
      case 'tool_calls': return 'tool_use'
      default: return reason ?? 'end_turn'
    }
  }
}
