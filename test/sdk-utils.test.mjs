import assert from 'node:assert/strict'
import test from 'node:test'

import {
  estimateTokens,
  estimateMessagesTokens,
  getAutoCompactThreshold,
  getContextWindowSize,
  getTokenCountFromUsage,
} from '../dist/utils/tokens.js'
import {
  createAutoCompactState,
  microCompactMessages,
  shouldAutoCompact,
} from '../dist/utils/compact.js'
import {
  extractTextFromContent,
  normalizeMessagesForAPI,
  stripImagesFromMessages,
  truncateText,
} from '../dist/utils/messages.js'
import {
  formatApiError,
  getRetryDelay,
  isAuthError,
  isPromptTooLongError,
  isRetryableError,
  withRetry,
} from '../dist/utils/retry.js'
import { FileStateCache } from '../dist/utils/fileCache.js'

test('token utilities estimate usage, model limits, and cache usage', () => {
  assert.equal(estimateTokens('hello'), 2)
  assert.equal(estimateMessagesTokens([
    { role: 'user', content: 'abcd' },
    { role: 'assistant', content: [{ type: 'text', text: 'efgh' }] },
  ]), 2)
  assert.equal(getTokenCountFromUsage({ input_tokens: 2, output_tokens: 3, cache_read_input_tokens: 4 }), 9)
  assert.equal(getContextWindowSize('gpt-4o-mini'), 128_000)
  assert.equal(getAutoCompactThreshold('gpt-4o'), 115_000)
})

test('compaction thresholds and micro-compaction behave deterministically', () => {
  const state = createAutoCompactState()
  assert.equal(shouldAutoCompact([{ role: 'user', content: 'x'.repeat(460_000) }], 'gpt-4o', state), true)
  assert.equal(shouldAutoCompact([{ role: 'user', content: 'x'.repeat(460_000) }], 'gpt-4o', { ...state, consecutiveFailures: 3 }), false)
  const [message] = microCompactMessages([{ role: 'user', content: [{ type: 'tool_result', content: 'abcdefghij' }] }], 6)
  assert.equal(message.content[0].content, 'abc\n...(truncated)...\nhij')
})

test('message normalization merges user messages and removes orphaned tool results', () => {
  const normalized = normalizeMessagesForAPI([
    { role: 'user', content: 'first' },
    { role: 'user', content: 'second' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'valid', name: 'read', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'orphan', content: 'no' }, { type: 'tool_result', tool_use_id: 'valid', content: 'yes' }] },
  ])
  assert.deepEqual(normalized[0], { role: 'user', content: [{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }] })
  assert.deepEqual(normalized[2].content, [{ type: 'tool_result', tool_use_id: 'valid', content: 'yes' }])
  assert.equal(extractTextFromContent([{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }]), 'ab')
  assert.equal(stripImagesFromMessages([{ role: 'user', content: [{ type: 'image' }] }])[0].content, '[content removed]')
  assert.equal(truncateText('abcdefghij', 6), 'abc\n...(truncated)...\nhij')
})

test('retry helpers classify errors and retry transient failures without sleeping', async () => {
  assert.equal(isRetryableError({ status: 429 }), true)
  assert.equal(isRetryableError({ code: 'ECONNRESET' }), true)
  assert.equal(isRetryableError({ status: 400 }), false)
  assert.equal(isAuthError({ status: 401 }), true)
  assert.equal(isPromptTooLongError({ status: 400, message: 'context length exceeded' }), true)
  assert.match(formatApiError({ status: 429 }), /Rate limit exceeded/)
  const delay = getRetryDelay(2, { maxRetries: 1, baseDelayMs: 4, maxDelayMs: 100, retryableStatusCodes: [429] })
  assert.ok(delay >= 12 && delay <= 20)
  let attempts = 0
  const result = await withRetry(async () => {
    attempts += 1
    if (attempts === 1) throw { status: 429 }
    return 'recovered'
  }, { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0, retryableStatusCodes: [429] })
  assert.equal(result, 'recovered')
  assert.equal(attempts, 2)
})

test('file cache normalizes paths, evicts least-recently-used entries, and clones independently', () => {
  const cache = new FileStateCache(2, 100)
  cache.set('/tmp/a', { content: 'a', timestamp: 1 })
  cache.set('/tmp/b', { content: 'b', timestamp: 2 })
  assert.equal(cache.get('/tmp/a')?.content, 'a')
  cache.set('/tmp/c', { content: 'c', timestamp: 3 })
  assert.equal(cache.get('/tmp/b'), undefined)
  const clone = cache.clone()
  clone.delete('/tmp/a')
  assert.equal(cache.get('/tmp/a')?.content, 'a')
  assert.equal(clone.get('/tmp/a'), undefined)
})
