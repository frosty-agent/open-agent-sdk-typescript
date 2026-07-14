/** Native OpenRouter SDK provider: converts the SDK's normalized tool loop format. */
import { OpenRouter } from '@openrouter/sdk'
import type {
  CreateMessageParams,
  CreateMessageResponse,
  LLMProvider,
  NormalizedContentBlock,
  NormalizedMessageParam,
  NormalizedTool,
} from './types.js'

type OpenRouterToolCall = { id: string; type?: string; function: { name: string; arguments: string } }
type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: OpenRouterToolCall[]
  toolCallId?: string
}
export interface OpenRouterChatResponse {
  choices: Array<{
    finishReason: string | null
    message: { content?: string | null; toolCalls?: OpenRouterToolCall[] }
  }>
  usage?: { promptTokens: number; completionTokens: number; cost?: number | null }
}
export interface OpenRouterRequest {
  model: string
  maxTokens: number
  messages: OpenRouterMessage[]
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>
  provider?: Record<string, unknown>
  stream: false
}
export interface OpenRouterClient { chat: { send(request: { chatRequest: OpenRouterRequest }): Promise<OpenRouterChatResponse> } }
export interface OpenRouterProviderOptions {
  apiKey?: string
  baseURL?: string
  client?: OpenRouterClient
  /** OpenRouter's documented provider-routing preferences, forwarded untouched. */
  provider?: Record<string, unknown>
}

export class OpenRouterProvider implements LLMProvider {
  readonly apiType = 'openrouter' as const
  private client: OpenRouterClient
  private provider?: Record<string, unknown>

  constructor(opts: OpenRouterProviderOptions = {}) {
    this.client = opts.client ?? new OpenRouter({ apiKey: opts.apiKey, serverURL: opts.baseURL }) as unknown as OpenRouterClient
    this.provider = opts.provider
  }

  async createMessage(params: CreateMessageParams): Promise<CreateMessageResponse> {
    const response = await this.client.chat.send({ chatRequest: {
      model: params.model,
      maxTokens: params.maxTokens,
      messages: this.convertMessages(params.system, params.messages),
      tools: params.tools?.map(tool => this.convertTool(tool)),
      provider: this.provider,
      stream: false,
    } })
    const choice = response.choices[0]
    const toolCalls = choice?.message.toolCalls ?? []
    const content = [
      ...(choice?.message.content ? [{ type: 'text' as const, text: choice.message.content }] : []),
      ...toolCalls.map(call => ({ type: 'tool_use' as const, id: call.id, name: call.function.name, input: parseArguments(call.function.arguments) })),
    ]
    return {
      content,
      stopReason: this.mapFinishReason(choice?.finishReason),
      usage: { input_tokens: response.usage?.promptTokens ?? 0, output_tokens: response.usage?.completionTokens ?? 0, cost: response.usage?.cost ?? undefined },
    }
  }

  private convertTool(tool: NormalizedTool): NonNullable<OpenRouterRequest['tools']>[number] {
    return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }
  }

  private convertMessages(system: string, messages: NormalizedMessageParam[]): OpenRouterMessage[] {
    const result: OpenRouterMessage[] = []
    if (system) result.push({ role: 'system', content: system })
    for (const message of messages) {
      if (typeof message.content === 'string') { result.push({ role: message.role, content: message.content }); continue }
      const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
      const calls = message.content.filter((block): block is Extract<NormalizedContentBlock, { type: 'tool_use' }> => block.type === 'tool_use')
      const results = message.content.filter((block): block is Extract<NormalizedContentBlock, { type: 'tool_result' }> => block.type === 'tool_result')
      if (message.role === 'assistant') result.push({ role: 'assistant', content: text, ...(calls.length ? { toolCalls: calls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } })) } : {}) })
      else {
        if (text) result.push({ role: 'user', content: text })
        for (const toolResult of results) result.push({ role: 'tool', toolCallId: toolResult.tool_use_id, content: toolResult.content })
      }
    }
    return result
  }

  private mapFinishReason(reason: string | null | undefined): string {
    switch (reason) { case 'stop': return 'end_turn'; case 'length': return 'max_tokens'; case 'tool_calls': return 'tool_use'; default: return reason ?? 'end_turn' }
  }
}
function parseArguments(argumentsJson: string): unknown { try { return JSON.parse(argumentsJson) } catch { return { _raw: argumentsJson } } }
