// Spec Section 4.3: the task normalizer.
import { chatJSON } from './llmClient.js';
import { CONFIG } from '../config.js';

const SYSTEM_PROMPT = `You are the task normalizer for Nerve, a personal task-routing system.
Given a raw task statement from the owner, respond with ONLY a JSON object (no prose, no markdown fences) with exactly these fields:
{
  "intent": string,
  "entities": string[],
  "constraints": string[],
  "urgency": "low" | "normal" | "high",
  "goal": string | null,
  "confidence": number,
  "clarifying_question": string | null
}

Field rules:
- "intent": one-sentence restatement of what the owner wants.
- "entities": named entities/subjects/systems the task involves.
- "constraints": hard constraints ONLY. Run a Simplification Pass first: strip any requirement not strictly necessary for the task's success check.
- "goal": one-sentence success statement ("done means..."). Set to null if the task's success cannot be stated in one sentence — that is a signal the task belongs in Project, not a reason to force a sentence.
- "confidence": 0-1, your certainty in this interpretation.
- "clarifying_question": if confidence is low, exactly ONE question that would most improve your interpretation. Otherwise null. Never ask more than one.`;

export async function normalize({ rawInput, sourceDevice, priorAnswer }) {
  const user = priorAnswer
    ? `Original task: ${rawInput}\n\nOwner's answer to your clarifying question: ${priorAnswer}\n\nProduce the final normalized statement now. Do not ask another question — clarifying_question must be null.`
    : `Task: ${rawInput}\nSource device: ${sourceDevice}`;

  const result = await chatJSON({
    apiKey: process.env.LITELLM_NORMALIZER_KEY,
    model: CONFIG.normalizerTier,
    system: SYSTEM_PROMPT,
    user,
  });

  // Spec: the normalizer asks one clarifying question, then proceeds —
  // never a second round.
  if (priorAnswer) result.clarifying_question = null;
  return result;
}
