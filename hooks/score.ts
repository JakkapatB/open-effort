import type { EngineInterface } from 'claude-code'

import type { Clarity, ModelTier, Score, Size } from '../types'

/** How long Haiku has to score a request; the prompt does not wait for it past SCORE_GRACE_MS. */
export const SCORE_TIMEOUT_MS = 15000

/** How long a prompt waits for its score, so a quick one still goes with it; a later one follows as a row. */
export const SCORE_GRACE_MS = 1200

/** Haiku's instructions: one line of readings, in the words parseScore reads. */
export const SCORE_SYSTEM = [
  'You score one request a person typed to a coding agent. Reply with exactly one line and nothing else:',
  'clarity=<clear|goal|unclear> hard=<yes|no> risky=<yes|no> size=<none|small|borderline|large> model=<haiku|sonnet|opus|fable> sure=<0-100>',
  'clarity: clear = the work could be described in one sentence and the way to do it is known (a rename, a known pattern applied across files, a one-line fix, a direct question); goal = the goal is clear but the way needs some thought (well-scoped daily work); unclear = the plan is not known yet and needs exploring, investigating or deciding first.',
  'hard: yes only for unusually hard work: concurrency, data migrations, security-sensitive logic, elusive bugs, deep multi-step reasoning.',
  'risky: yes when a mistake would touch authentication, money, personal data, data loss or security.',
  'size: how much implementation it asks for: none = no code change (a question, an explanation, a review, exploring); small = a contained change in one or two places; large = a feature or a change across several files that needs new tests; borderline = between small and large.',
  'model: the least capable Claude model that does this work well: haiku = a direct question or a small, clear edit; sonnet = everyday, well-scoped coding; opus = complex work across many files, hard debugging, design decisions; fable = the hardest, long-horizon work needing the deepest reasoning, where opus would struggle.',
  'sure: how sure you are of these readings, 0 to 100. Be honest: a short, vague or ambiguous request is not above 60.',
  'When the message comes after what Claude said last, add continue=<yes|no> to the line. yes only when the message is a reply to what Claude said: it answers Claude\'s question, picks one of the options Claude offered, approves or rejects what Claude proposed, or corrects or narrows the work Claude is doing (for example "skip the old models", "use the second option", "no, keep the name"). no when it asks for anything Claude did not offer or ask about, even in the same project: writing a new file or document, translating, explaining something else, a new feature or fix (for example "write a README", "translate this", "now add a login page"). When unsure, no.',
  'Score the readings for the work the message asks for either way.',
  'The request may be in Thai or any other language.',
].join('\n')

const CLARITIES: readonly Clarity[] = ['clear', 'goal', 'unclear']
const SIZES: readonly Size[] = ['none', 'small', 'borderline', 'large']
/** The model families, least capable first. */
export const MODEL_TIERS: readonly ModelTier[] = ['haiku', 'sonnet', 'opus', 'fable']

function field(reply: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*[=:]\\s*([a-z]+)`, 'i').exec(reply)?.[1]?.toLowerCase()
}

/**
 * The score in Haiku's reply; null when it names no clarity. A reading left out is no, or no implementation; a
 * confidence left out is unknown.
 */
export function parseScore(reply: string): Score | null {
  const clarity = field(reply, 'clarity')
  if (!CLARITIES.includes(clarity as Clarity)) return null
  const size = field(reply, 'size')
  const model = field(reply, 'model')
  const sure = /\bsure\s*[=:]\s*(\d{1,3})/i.exec(reply)?.[1]
  return {
    clarity: clarity as Clarity,
    isHard: field(reply, 'hard') === 'yes',
    isRisky: field(reply, 'risky') === 'yes',
    size: SIZES.includes(size as Size) ? (size as Size) : 'none',
    ...(sure !== undefined ? { confidence: Math.min(100, Number(sure)) } : {}),
    ...(MODEL_TIERS.includes(model as ModelTier) ? { model: model as ModelTier } : {}),
    ...(field(reply, 'continue') === 'yes' ? { continues: true } : {}),
  }
}

/** Below this, Haiku is unsure of its readings: work does not start at low, and large work is asked about. */
export const UNSURE_BELOW = 60

export function isUnsure(score: Score): boolean {
  return score.confidence !== undefined && score.confidence < UNSURE_BELOW
}

/** A score, or why there is none: the call's reason, or `unparsed` with Haiku's reply when it named no clarity. */
export type Scored = { score: Score | null; outcome: string }

/** How much of what Claude said last goes with a message to Haiku, from its end. */
const SAID_CHARS = 800

/**
 * One Haiku call with the whole request, at low effort: it decides, it does not reason at length. With what Claude
 * said last (`said`), Haiku also judges whether the message goes on with the work under way. No score when it times
 * out, fails or answers none.
 */
export async function scoreRequest($: EngineInterface, text: string, said?: string): Promise<Scored> {
  const prompt = said ? `Claude said last:\n${said.slice(-SAID_CHARS)}\n\nThe person now typed:\n${text.trim()}` : text.trim()
  const res = await $.model.complete({ model: 'haiku', system: SCORE_SYSTEM, prompt, maxTokens: 64, effort: 'low', timeoutMs: SCORE_TIMEOUT_MS })
  if (!res.isAnswered) return { score: null, outcome: res.reason === 'api-error' ? `api-error ${res.status ?? ''}`.trim() : res.reason }
  const score = parseScore(res.text)
  return { score, outcome: score ? 'scored' : `unparsed: ${res.text.slice(0, 120)}` }
}

// A short reply that only says go on, in English or Thai, with polite endings.
const GO_ON = /^(?:ok(?:ay)?|yes|yep|y|go|go on|continue|next|sure|do it|ต่อ|ทำต่อ|ต่อเลย|ทำเลย|ได้เลย|ได้|โอเค|ตกลง|เอาเลย|จัดไป|ลุย|ใช่)(?:\s*(?:ครับ|ค่ะ|คะ|คับ|นะ|เลย|สิ|ซิ|จ้า|จ้ะ|จ๊ะ|หน่อย))*[\s!.,]*$/i

/** A message of 20 characters or less that adds no new request ("ok", "ทำต่อ", "ได้เลยครับ"). */
export function isGoOn(text: string): boolean {
  // SARA AM typed or normalised as NIKHAHIT + SARA AA reads as the one letter (ทำ).
  const t = text.trim().replace(/\u0E4D\u0E32/g, '\u0E33')
  return t.length > 0 && t.length <= 20 && GO_ON.test(t)
}
