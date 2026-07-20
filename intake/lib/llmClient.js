// Thin LiteLLM client. Every call must produce strict JSON — no prose, no
// markdown fences — enforced by prompt instruction and a hard parse.
export async function chatJSON({ apiKey, model, system, user, maxTokens = 1024 }) {
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
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteLLM call failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  let content = data.choices[0].message.content.trim();
  // Models occasionally wrap JSON in a markdown fence despite instruction
  // not to — strip it rather than fail on an otherwise-valid response.
  const fenced = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) content = fenced[1];
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Model did not return valid JSON:\n${content}`);
  }
}
