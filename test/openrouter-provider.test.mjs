import assert from 'node:assert/strict'
import test from 'node:test'

import { OpenRouterProvider, createProvider } from '../dist/index.js'

test('OpenRouterProvider translates simple text requests and provider usage cost', async () => {
  let request
  const client = {
    chat: {
      async send(value) {
        request = value
        return {
          choices: [{ finishReason: 'stop', message: { content: 'Hello from OpenRouter' } }],
          usage: { promptTokens: 11, completionTokens: 7, cost: 0.000123 },
        }
      },
    },
  }
  const provider = new OpenRouterProvider({ client })

  const response = await provider.createMessage({
    model: 'openai/gpt-4o-mini',
    maxTokens: 64,
    system: 'Be concise.',
    messages: [{ role: 'user', content: 'Say hello.' }],
  })

  assert.deepEqual(request, {
    chatRequest: {
      model: 'openai/gpt-4o-mini',
      maxTokens: 64,
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Say hello.' },
      ],
      stream: false,
    },
  })
  assert.deepEqual(response, {
    content: [{ type: 'text', text: 'Hello from OpenRouter' }],
    stopReason: 'end_turn',
    usage: { input_tokens: 11, output_tokens: 7, cost: 0.000123 },
  })
})

test('createProvider wires apiType openrouter to the native provider', () => {
  const provider = createProvider('openrouter', {
    client: { chat: { send: async () => ({ choices: [] }) } },
  })

  assert.ok(provider instanceof OpenRouterProvider)
  assert.equal(provider.apiType, 'openrouter')
})
