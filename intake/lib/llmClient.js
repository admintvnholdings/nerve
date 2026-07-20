// Thin LiteLLM client.
async function callOnce({ apiKey, model, system, user, maxTokens, signal }) {
  const baseUrl = process.env.LITELLM_BASE_URL;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteLLM call failed (${res.status}): ${text}`);
  }

  const costHeader = res.headers.get('x-litellm-response-cost');
  const data = await res.json();
  return {
    content: data.choices[0].message.content.trim(),
    tokens: data.usage?.total_tokens ?? 0,
    costUsd: costHeader ? Number(costHeader) : 0,
  };
}

// Every call must produce strict JSON — no prose, no markdown fences —
// enforced by prompt instruction and a hard parse. Single attempt: used by
// the M2 normalizer/router, which aren't in scope for M3's retry amendment.
export async function chatJSON({ apiKey, model, system, user, maxTokens = 1024 }) {
  const { content } = await callOnce({ apiKey, model, system, user, maxTokens });
  // Models occasionally wrap JSON in a markdown fence despite instruction
  // not to — strip it rather than fail on an otherwise-valid response.
  const fenced = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const text = fenced ? fenced[1] : content;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Model did not return valid JSON:\n${text}`);
  }
}

// Free-text completion with a bounded, self-managed retry: attempts run
// inside this call (not Temporal's automatic activity retry) specifically
// so cost/tokens from every attempt — including ones that fail after
// LiteLLM already billed a completion — get summed into the result rather
// than discarded, which is what Temporal's own retry would do.
export async function chatText({
  apiKey, model, system, user, maxTokens = 1024,
  maxAttempts = 3, attemptTimeoutMs = 30_000,
}) {
  let totalTokens = 0;
  let totalCostUsd = 0;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      const { content, tokens, costUsd } = await callOnce({
        apiKey, model, system, user, maxTokens, signal: controller.signal,
      });
      totalTokens += tokens;
      totalCostUsd += costUsd;
      if (!content) {
        lastError = new Error('Model returned an empty completion');
        continue;
      }
      return { text: content, totalTokens, totalCostUsd, attempts: attempt };
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw Object.assign(
    new Error(`chatText failed after ${maxAttempts} attempts: ${lastError?.message}`),
    { totalTokens, totalCostUsd },
  );
}
