import assert from 'node:assert/strict'
import test from 'node:test'

import { OpenRouterProvider, createProvider } from '../dist/index.js'

test('OpenRouterProvider translates text, tools, routing, and tool results without network I/O', async () => {
  let request
  const client = { chat: { async send(value) {
    request = value
    return {
      choices: [{ finishReason: 'tool_calls', message: { content: 'I will inspect it.', toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] } }],
      usage: { promptTokens: 11, completionTokens: 7, cost: 0.000123 },
    }
  } } }
  const provider = new OpenRouterProvider({ client, provider: { order: ['Anthropic'], allowFallbacks: false } })
  const response = await provider.createMessage({
    model: 'openai/gpt-4o-mini', maxTokens: 64, system: 'Be concise.',
    messages: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 'prior_call', name: 'read_file', input: { path: 'old.md' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'prior_call', content: 'old contents' }] },
      { role: 'user', content: 'Now inspect README.' },
    ],
    tools: [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }],
  })
  assert.deepEqual(request, { chatRequest: {
    model: 'openai/gpt-4o-mini', maxTokens: 64, stream: false, provider: { order: ['Anthropic'], allowFallbacks: false },
    tools: [{ type: 'function', function: { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } }],
    messages: [
      { role: 'system', content: 'Be concise.' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'prior_call', type: 'function', function: { name: 'read_file', arguments: '{"path":"old.md"}' } }] },
      { role: 'tool', toolCallId: 'prior_call', content: 'old contents' },
      { role: 'user', content: 'Now inspect README.' },
    ],
  } })
  assert.deepEqual(response, { content: [
    { type: 'text', text: 'I will inspect it.' },
    { type: 'tool_use', id: 'call_1', name: 'read_file', input: { path: 'README.md' } },
  ], stopReason: 'tool_use', usage: { input_tokens: 11, output_tokens: 7, cost: 0.000123 } })
})

test('createProvider wires explicit apiType openrouter to the native provider', () => {
  const provider = createProvider('openrouter', { client: { chat: { send: async () => ({ choices: [] }) } } })
  assert.ok(provider instanceof OpenRouterProvider)
  assert.equal(provider.apiType, 'openrouter')
})
