/**
 * The bounds the local summarizer enforces on the facts it sends to Ollama.
 * `facts.ts` builds within them and `ollama.ts` verifies them, so a fact that
 * is valid when built stays valid when sent.
 */
export const MAX_FACT_LABEL_CHARS = 100;
export const MAX_FACT_VALUE_CHARS = 300;
export const MAX_FACTS_PER_REQUEST = 32;

/**
 * The hard bound the fact guard enforces on a generated summary. The reply is
 * capped at 768 tokens, but the prompt asks for under 1,000 characters, so this
 * bound does not reject an audit that follows the instruction.
 */
export const MAX_SUMMARY_CHARS = 1_200;

/** The smaller target asked of the model, leaving room under the hard bound. */
export const SUMMARY_CHAR_TARGET = 1_000;

/**
 * Context requested for a summary. The prompt is capped at 9,000 characters
 * (about 2,500 tokens) plus 768 output tokens, and Ollama defaults to 4K below
 * 24 GiB of VRAM, which leaves no headroom for a long Overview.
 */
export const SUMMARY_NUM_CTX = 8_192;

/**
 * Context requested for a policy report. Up to 30,000 characters of policy text
 * is roughly 8,000 tokens, plus the instructions and 260 output tokens, so the
 * previous 8,000 setting silently truncated the longest policies. 16,384 fits
 * the full input and leaves room for the reply.
 */
export const POLICY_REPORT_NUM_CTX = 16_384;
