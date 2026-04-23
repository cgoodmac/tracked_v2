// Client-side wrapper around /api/ai (the serverless Anthropic proxy).
//
// Two exports today:
//   callAI(body)            — generic passthrough (POST body -> Messages API body)
//   parseCheckinText(args)  — daily check-in shortcut: build the system prompt,
//                             send, parse the returned JSON into { message, actions }
//
// Onboarding parsers:
//   parseGoalsText(args)    — free-text goals → ["reduce anxiety", ...]
//   parseStackText(args)    — free-text stack → [{name, type, dose, ...}, ...]
//
// Later phases of the build will add:
//   runAnalysis()     — 14-day insights report
//   chatReply()       — free-form chat for stack changes and questions

import { INTERVENTION_TYPES, todayISO, colorFromPalette } from './constants.js'

const MODEL = 'claude-sonnet-4-6' // Claude Sonnet 4.6 — swap when needed
const DEFAULT_MAX_TOKENS = 1024
// Stack parsing can produce long responses — full health docs can easily exceed
// 2K output tokens. Set a ceiling high enough that truncation is unlikely.
const STACK_MAX_TOKENS = 8192

// ---------- Low-level: talk to the proxy ----------
export async function callAI(body, { signal } = {}) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`AI proxy ${res.status}: ${text || res.statusText}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// Extract the string content from an Anthropic Messages API response.
function extractText(apiResponse) {
  if (!apiResponse) return ''
  if (Array.isArray(apiResponse.content)) {
    return apiResponse.content
      .filter(b => b && b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text)
      .join('\n')
      .trim()
  }
  return ''
}

// Extract the first JSON object from a text blob. The model is asked to return
// JSON only, but we defend against stray prose, code fences, etc.
function extractJSON(text) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  // Find first { ... } block with balanced braces.
  const start = candidate.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1)
        try { return JSON.parse(slice) } catch { return null }
      }
    }
  }
  return null
}

// ---------- Daily check-in parser ----------
//
// Takes a natural-language update from the user ("Took everything except fish
// oil, slept 6 hours, felt pretty anxious today") and the current app state,
// and returns:
//   { message: string, actions: Array<{type, data}> }
//
// The actions returned will always be a subset of:
//   - log_checkin  (or update_checkin)   with per-metric scores
//   - log_taken                          with per-intervention taken/skipped
//
// Caller (CheckinScreen) applies these actions to local state so the sliders
// and checkboxes update visually. The user still taps "Log day" to save.
export async function parseCheckinText({ userText, goals, metrics, interventions, todaysCheckin }) {
  if (!userText || !userText.trim()) {
    return { message: '', actions: [] }
  }

  const system = buildCheckinSystemPrompt({ goals, metrics, interventions, todaysCheckin })

  const apiResponse = await callAI({
    model: MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system,
    messages: [
      { role: 'user', content: userText.trim() },
    ],
  })

  const raw = extractText(apiResponse)
  const parsed = extractJSON(raw)

  if (!parsed) {
    return {
      message: raw || "Sorry, I couldn't understand that. Try adjusting the sliders manually.",
      actions: [],
    }
  }

  const actions = Array.isArray(parsed.actions) ? parsed.actions : []
  return {
    message: typeof parsed.message === 'string' ? parsed.message : '',
    actions,
  }
}

function buildCheckinSystemPrompt({ goals, metrics, interventions, todaysCheckin }) {
  const today = todayISO()

  const metricsArr = Array.isArray(metrics) ? metrics : []
  const metricTable = metricsArr.length
    ? metricsArr.map(m => {
        const dir = m.direction === 'down'
          ? 'lower is better'
          : 'higher is better'
        return `  - ${m.name} (id=${m.id}): 1 (${m.low || 'low'}) to 10 (${m.high || 'high'}) — ${dir}`
      }).join('\n')
    : '  (no metrics configured yet)'

  const goalsLine = (goals && goals.length)
    ? goals.map(g => `"${g?.name ?? g}"`).join(', ')
    : '(not set)'

  const active = (interventions || []).filter(i => i.status !== 'stopped')
  const stackLines = active.length
    ? active.map(i => {
        const parts = [i.name]
        if (i.dose) parts.push(i.dose)
        if (i.frequency) parts.push(i.frequency)
        return `  - id=${i.id} | ${parts.join(' · ')}${i.notes ? ` (${i.notes})` : ''}`
      }).join('\n')
    : '  (empty)'

  const scoresSoFar = todaysCheckin?.scores || {}
  const currentScores = metricsArr.length
    ? metricsArr.map(m => `${m.name}=${scoresSoFar[m.id] ?? '—'}`).join(', ')
    : '(not started)'

  return `You are Tracked, an assistant that helps a user log their daily health check-in and manage their tracking setup.

Today's date: ${today}
The user's goals: ${goalsLine}

Active stack (use these exact ids in log_taken actions):
${stackLines}

Today's current check-in so far: ${currentScores}

The user's metrics (use the metric id when writing log_checkin or log_measurement actions):
${metricTable}

The user will send a short natural-language message. Your job is to convert it into structured actions. They might be:
- Logging today's check-in ("felt great, took everything")
- Adding a new intervention to their stack ("I started taking tongkat ali 600mg")
- Adding a new thing to track ("I also want to track joint pain")
- Logging a new objective measurement ("body fat came back at 18% today", "latest resting HR is 58")

Rules:
1. Respond with a single JSON object. No prose outside the JSON. No code fences.
2. Shape: { "message": string, "actions": [ { "type": string, "data": object } ] }
3. "message" is a one-sentence conversational acknowledgment (e.g. "Got it — added L-theanine to your stack.").

ACTION TYPES:

a) "log_checkin" — set metric scores for today on scale-type metrics only.
   Shape: { "type": "log_checkin", "data": { "scores": { "<metric-id>": 7, ... } } }
   Use the metric ids shown above. Only include metrics the user gave signal about; do not invent numbers.
   For metrics where direction=down (lower is better), a user saying "anxiety is bad today" means a LOW number; "felt calm" means a HIGH number. For direction=up metrics (higher is better), standard mapping: "great energy" → high, "drained" → low.

b) "log_taken" — set what was taken vs skipped today.
   Shape: { "type": "log_taken", "data": { "items": [ { "id": "<id>", "taken": true|false } ] } }
   Prefer the id field; fall back to name only if you don't have an id.
   If the user says "took everything" or "all" — mark every active intervention as taken. If they list skips, mark those false and everyone else true.

c) "add_intervention" — add a new intervention to the stack when the user says they started/began/added something.
   Shape: { "type": "add_intervention", "data": { "name": "L-Theanine", "type": "supplement", "dose": "200mg", "frequency": "Daily", "notes": null } }
   Types: supplement, medication, habit, exercise, therapy, diet, device, other.
   Only use this when the intervention is NOT already in the stack above.

d) "add_metric" — add a new metric to track when the user says they want to start tracking something new.
   Shape: { "type": "add_metric", "data": { "name": "joint pain", "label": "Joint pain", "type": "scale" | "periodic", "direction": "up" | "down", "icon": "🦴", "low": "painful", "high": "fine", "unit": null, "cadence": null, "asGoal": true } }
   For scale metrics: set low/high, leave unit/cadence null.
   For periodic metrics (measurements with a tool/lab): set unit (e.g. "%", "ng/dL") and cadence ("monthly", "per lab result"), leave low/high null.
   Set direction="down" when lower is better (pain, anxiety, body fat), "up" otherwise.
   Only use this when the metric is NOT already in the metrics list above.

e) "log_measurement" — log a periodic measurement value (lab result, weigh-in, wearable reading).
   Shape: { "type": "log_measurement", "data": { "metricId": "<id>", "value": 18.2, "note": null, "date": "${today}" } }
   ONLY use this for metrics with type="periodic" in the metrics list. Never use this for scale metrics — those use log_checkin instead.
   Prefer metricId; fall back to metricName if unsure.

GENERAL:
- If the user says something you can't confidently map, leave it out of actions but acknowledge in the message.
- Never invent metrics or interventions as already-existing that aren't in the lists above. To add new ones, use add_metric / add_intervention explicitly.
- Multiple actions in a single response are allowed and encouraged when the user says several things.

Respond now with JSON only.`
}

// ===================================================================
// Onboarding: goals parsing (with metric extraction)
// ===================================================================
//
// Input: a free-text message ranging from one sentence to a long health
// narrative.
//
// Output: {
//   goals: [{ id, name, metricId|null, priority, tracked, note|null }, ...],
//   metrics: [{ id, name, label, direction, low, high, icon, color }, ...],
//   offline?: boolean,
//   reason?: 'truncated' | 'no-items' | 'error'
// }
//
// The AI consolidates overlapping goals, drops resolved ones, marks
// untrackable ones as tracked=false, and proposes a short metric set that
// each tracked goal points to via metricId. If the AI fails, a very
// conservative local fallback produces a minimal goals/metrics structure so
// the UI doesn't break.
// Long health narratives (like a full intake paragraph) can produce responses
// that pack 8 goals + 6–10 metrics with notes. At 2048 we were truncating
// mid-JSON and silently falling through to localParseGoals, which comma-splits
// the raw text — producing garbage like "and interact with people better. i
// think it stems from: genetics" as a standalone goal. Match the stack
// parser's headroom (8192) so truncation stops being a realistic failure mode.
const GOALS_MAX_TOKENS = 8192

export async function parseGoalsText({ userText }) {
  const text = (userText || '').trim()
  if (!text) return { goals: [], metrics: [] }

  try {
    const apiResponse = await callAI({
      model: MODEL,
      max_tokens: GOALS_MAX_TOKENS,
      system: GOALS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    })

    if (apiResponse?.stop_reason === 'max_tokens') {
      console.warn('parseGoalsText: response truncated at max_tokens')
      return { ...localParseGoals(text), offline: true, reason: 'truncated' }
    }

    const raw = extractText(apiResponse)
    const parsed = extractJSON(raw)
    const normalized = normalizeGoalsResponse(parsed)
    if (normalized.goals.length) return normalized

    console.warn('parseGoalsText: AI returned no parsable goals. Raw:', raw?.slice(0, 500))
    return { ...localParseGoals(text), offline: true, reason: 'no-items' }
  } catch (err) {
    console.warn('parseGoalsText: AI failed, using local fallback', err)
    return { ...localParseGoals(text), offline: true, reason: 'error' }
  }
}

const GOALS_SYSTEM_PROMPT = `You are helping a user translate a health/wellness description into a focused tracking plan.

The user will describe what they want to improve — anywhere from one sentence to several paragraphs. Your job is to produce:
1. A short, prioritized list of GOALS.
2. A set of METRICS, where each trackable goal maps to exactly one metric.

Metrics come in two types — this distinction is CRITICAL and gets classified wrong often:

- type="scale" — a SUBJECTIVE FEELING the user can rate on a 1–10 scale from memory, every single day, without any tools. Examples: anxiety, energy, focus, mood, sex drive, sleep quality, pain, gut comfort, motivation, stress.
  Test: "Could the user honestly answer this on a 1–10 scale right now, just by checking in with themselves?" If yes → scale.

- type="periodic" — an OBJECTIVE NUMERIC MEASUREMENT that requires a tool, test, lab, or device. The user doesn't rate it — they enter a real number with a real unit, whenever they happen to have new data (lab results, a weigh-in, a wearable reading). Examples: body fat %, weight (lbs/kg), waist circumference (cm), BMI, sperm count (million/mL), sperm motility (%), testosterone (ng/dL), estradiol (pg/mL), cholesterol (mg/dL), HbA1c (%), resting heart rate (bpm), VO2 max (mL/kg/min), HRV (ms), blood pressure (mmHg), lean body mass (lbs), waist-to-hip ratio.
  Test: "Does answering this require a lab result, a scale, a tape measure, a wearable, or a medical test?" If yes → periodic. NEVER scale.

HARD RULE: If a metric has a real unit of measurement (%, lbs, kg, cm, ng/dL, million/mL, bpm, mL/kg/min, ms, mmHg, mg/dL), it MUST be type="periodic". No exceptions. Putting body fat %, sperm count, or VO2 max on a daily 1–10 slider is always wrong.

Respond with a single JSON object. No prose outside the JSON. No code fences.

Shape:
{
  "goals": [
    {
      "name": "short lowercase noun/verb phrase (2-5 words), e.g. 'reduce anxiety'",
      "priority": 1,
      "metric": "name of one of the metrics below, or null if this goal is purely aspirational",
      "note": "optional one-line clarification, or null"
    }
  ],
  "metrics": [
    {
      "name": "short lowercase identifier, e.g. 'anxiety', 'sperm count', 'body fat'",
      "label": "Sentence-case display label",
      "type": "scale" OR "periodic",
      "direction": "up" OR "down",
      "icon": "a single emoji",

      // REQUIRED when type="scale":
      "low": "word shown at 1, e.g. 'anxious', 'drained'",
      "high": "word shown at 10, e.g. 'calm', 'energized'",

      // REQUIRED when type="periodic":
      "unit": "the unit of measurement, e.g. 'lbs', '%', 'million/mL', 'ng/dL'",
      "cadence": "how often it is typically measured, e.g. 'per lab result', 'monthly', 'weekly'"
    }
  ]
}

RULES FOR GOALS:
- Hard cap: at most 8 goals. Fewer is better. Be ruthless.
- CONSOLIDATE overlapping themes. "reduce social anxiety", "reduce financial anxiety", and "reduce general anxiety" become ONE goal ("reduce anxiety") whose note mentions the contexts. "think more clearly" + "mental sharpness" + "improve memory" + "mental flexibility" all consolidate into one cognition goal (e.g., "sharper thinking").
- DROP goals the user explicitly describes as already resolved, fixed, recovered, or no longer a concern. Examples: "surgery went well", "I have not had any more episodes", "this is no longer a problem". Do NOT carry them forward as active goals.
- Aspirational goals with no measurable metric (daily OR periodic) use "metric": null. Examples: "maximize longevity", "maintain hair color", "be the best for my family". These are still kept as context.
- ORDER by priority. If the user said "top priority" or "most important", that goal is priority 1. Then follow any "in rough priority order" they implied. Priority is a simple 1, 2, 3… integer.
- Goal names are lowercase, concise noun/verb phrases. No punctuation.

RULES FOR METRICS — default to including as many as reasonable:
- Prefer matching goals with metrics. If something is measurable (even just periodically), propose a metric for it rather than leaving it untracked. Users want to track as much as they can.
- Body composition goals ("reduce belly fat", "build muscle") → propose periodic metrics like body fat % and/or weight.
- Fertility goals ("improve sperm quality") → propose periodic metrics like sperm count and/or motility.
- Hormonal goals ("raise testosterone") → propose periodic metrics like total testosterone (ng/dL).
- Cardio/longevity goals → propose periodic metrics like resting heart rate or VO2 max.
- Mental/emotional goals ("reduce anxiety", "sharper thinking") → propose scale metrics.
- Keep scale metrics to 3–6 (users rate them daily; more becomes tedious). Periodic metrics can be more numerous since they're occasional.
- Reuse metrics across goals where natural. Do not duplicate metrics.
- direction: "down" when a lower number is better (anxiety, pain, body fat, bloating). "up" when higher is better (energy, focus, sleep quality, sperm count, testosterone, VO2 max).
- For scale metrics, low/high are the feelings at the extremes in the user's emotional vocabulary. Always phrase so that 10 is the "good" end, even when direction="down".
- For periodic metrics, unit must be a real unit (%, lbs, kg, cm, ng/dL, million/mL, bpm, mL/kg/min, etc.). Cadence is how often this is typically measured in real life.
- Pick an evocative single emoji for each metric.

MAPPING GOALS TO METRICS:
- Every goal with a trackable metric must set "metric" to the exact name of a metric in the "metrics" array.
- Purely aspirational goals set "metric": null.

Respond now with JSON only.`

// Names that are always objective measurements even if the model tags them scale.
// Each entry is matched as a substring (case-insensitive) against the metric
// name AND label. Guesses a reasonable unit/cadence when one isn't provided.
const PERIODIC_NAME_PATTERNS = [
  { match: /\b(body\s*fat|bf\s*%)\b/i,                unit: '%',           cadence: 'monthly' },
  { match: /\bweight\b|\bbody\s*mass\b/i,             unit: 'lbs',         cadence: 'weekly' },
  { match: /\bbmi\b/i,                                unit: '',            cadence: 'monthly' },
  { match: /\blean\s*(body\s*)?mass\b/i,              unit: 'lbs',         cadence: 'monthly' },
  { match: /\bwaist\b|\bhip\b.*\bratio\b/i,           unit: 'cm',          cadence: 'monthly' },
  { match: /\bsperm\s*(count|concentration)\b/i,      unit: 'million/mL',  cadence: 'per lab result' },
  { match: /\bsperm\s*motility\b|\bmotility\b/i,      unit: '%',           cadence: 'per lab result' },
  { match: /\bmorphology\b/i,                         unit: '%',           cadence: 'per lab result' },
  { match: /\btestosterone\b/i,                       unit: 'ng/dL',       cadence: 'per lab result' },
  { match: /\bestradiol\b|\bestrogen\b/i,             unit: 'pg/mL',       cadence: 'per lab result' },
  { match: /\bcortisol\b/i,                           unit: 'µg/dL',       cadence: 'per lab result' },
  { match: /\bcholesterol\b|\bldl\b|\bhdl\b|\btriglycerides\b/i, unit: 'mg/dL', cadence: 'per lab result' },
  { match: /\bhba1c\b|\ba1c\b/i,                      unit: '%',           cadence: 'per lab result' },
  { match: /\bglucose\b|\bblood\s*sugar\b/i,          unit: 'mg/dL',       cadence: 'per lab result' },
  { match: /\bvo2\s*max\b/i,                          unit: 'mL/kg/min',   cadence: 'per lab result' },
  { match: /\bresting\s*(heart\s*rate|hr)\b|\brhr\b/i, unit: 'bpm',        cadence: 'weekly' },
  { match: /\bhrv\b|\bheart\s*rate\s*variability\b/i, unit: 'ms',          cadence: 'daily (from wearable)' },
  { match: /\bblood\s*pressure\b|\bbp\b/i,            unit: 'mmHg',        cadence: 'weekly' },
  { match: /\bvitamin\s*d\b|\b25[-\s]?oh\b/i,         unit: 'ng/mL',       cadence: 'per lab result' },
  { match: /\bferritin\b/i,                           unit: 'ng/mL',       cadence: 'per lab result' },
  { match: /\bb12\b|\bb-?12\b/i,                      unit: 'pg/mL',       cadence: 'per lab result' },
  { match: /\bthyroid\b|\btsh\b|\bt3\b|\bt4\b/i,      unit: 'mIU/L',       cadence: 'per lab result' },
  { match: /\bpsa\b/i,                                unit: 'ng/mL',       cadence: 'per lab result' },
  { match: /\bcrp\b|\binflammation\b/i,               unit: 'mg/L',        cadence: 'per lab result' },
]

// Units that signal a periodic metric — if the model set a unit like this,
// trust that over any "scale" tag it may have written.
const PERIODIC_UNIT_PATTERNS = [
  /^%$/, /^lbs?$/i, /^kg$/i, /^cm$/i, /^mm$/i, /^in(ches)?$/i,
  /^bpm$/i, /^ms$/i, /^mmhg$/i, /^ng\/dl$/i, /^ng\/ml$/i, /^pg\/ml$/i,
  /^µg\/dl$/i, /^ug\/dl$/i, /^mg\/dl$/i, /^mg\/l$/i, /^miu\/l$/i,
  /^million\/ml$/i, /^mL\/kg\/min$/i,
]

// Decide whether a raw metric object from the AI should be periodic based on
// its name, label, or unit — regardless of what the model's "type" field says.
function classifyMetricType(m) {
  const declared = m?.type === 'periodic' ? 'periodic' : (m?.type === 'scale' ? 'scale' : null)
  const name = String(m?.name || '').toLowerCase()
  const label = String(m?.label || '').toLowerCase()
  const unit = String(m?.unit || '').trim()

  // 1. Real unit → periodic (strongest signal).
  if (unit && PERIODIC_UNIT_PATTERNS.some(rx => rx.test(unit))) return 'periodic'

  // 2. Known periodic name pattern → periodic.
  const hit = PERIODIC_NAME_PATTERNS.find(p => p.match.test(name) || p.match.test(label))
  if (hit) return 'periodic'

  // 3. Fall back to whatever the model declared; default scale.
  return declared || 'scale'
}

// If a metric was upgraded to periodic but the AI didn't supply unit/cadence,
// fill them in from the pattern list so the UI has real values to show.
function inferPeriodicDefaults(m) {
  const name = String(m?.name || '').toLowerCase()
  const label = String(m?.label || '').toLowerCase()
  const hit = PERIODIC_NAME_PATTERNS.find(p => p.match.test(name) || p.match.test(label))
  return hit ? { unit: hit.unit, cadence: hit.cadence } : { unit: '', cadence: '' }
}

function normalizeGoalsResponse(parsed) {
  const metricsRaw = Array.isArray(parsed?.metrics) ? parsed.metrics : []
  const goalsRaw = Array.isArray(parsed?.goals) ? parsed.goals : []

  // Build the final metrics list. Each metric carries a type ('scale' or
  // 'periodic') so the UI can render them in different places. We run each
  // metric through classifyMetricType to override wrong calls from the AI —
  // e.g. body fat % tagged as "scale" gets forced to "periodic".
  const metrics = []
  const byName = new Map()
  metricsRaw.forEach((m, i) => {
    if (!m || typeof m.name !== 'string') return
    const name = m.name.trim().toLowerCase()
    if (!name || byName.has(name)) return
    const id = `m-${slugify(name)}-${i}`
    const type = classifyMetricType(m)
    const metric = {
      id,
      name,
      label: typeof m.label === 'string' && m.label.trim() ? m.label.trim() : capitalize(name),
      type,
      direction: m.direction === 'down' ? 'down' : 'up',
      icon: typeof m.icon === 'string' && m.icon.trim() ? m.icon.trim() : '•',
      color: typeof m.color === 'string' && m.color.trim() ? m.color.trim() : colorFromPalette(i),
    }
    if (type === 'scale') {
      metric.low = typeof m.low === 'string' && m.low.trim() ? m.low.trim() : (m.direction === 'down' ? 'bad' : 'low')
      metric.high = typeof m.high === 'string' && m.high.trim() ? m.high.trim() : (m.direction === 'down' ? 'good' : 'high')
    } else {
      // Periodic — prefer the AI's unit/cadence, but fall back to pattern-based
      // defaults when missing (common when we overrode type from scale).
      const defaults = inferPeriodicDefaults(m)
      metric.unit = typeof m.unit === 'string' && m.unit.trim() ? m.unit.trim() : defaults.unit
      metric.cadence = typeof m.cadence === 'string' && m.cadence.trim() ? m.cadence.trim() : defaults.cadence
    }
    metrics.push(metric)
    byName.set(name, metric)
  })

  // Build goals, linking each to a metric by name.
  const seen = new Set()
  const goals = []
  goalsRaw.forEach((g, i) => {
    if (!g || typeof g.name !== 'string') return
    const name = g.name.trim().toLowerCase()
    if (!name) return
    const key = name
    if (seen.has(key)) return
    seen.add(key)

    const metricName = typeof g.metric === 'string' ? g.metric.trim().toLowerCase() : null
    const metric = metricName ? byName.get(metricName) : null
    const priority = Number.isFinite(g.priority) ? Math.round(g.priority) : i + 1

    goals.push({
      id: `g-${slugify(name)}-${i}`,
      name,
      metricId: metric ? metric.id : null,
      tracked: !!metric,
      priority,
      note: typeof g.note === 'string' && g.note.trim() ? g.note.trim() : null,
    })
  })

  goals.sort((a, b) => a.priority - b.priority)

  // Trim metrics to only those referenced by at least one goal (the AI
  // sometimes over-generates). Keep the order the AI chose.
  const referenced = new Set(goals.map(g => g.metricId).filter(Boolean))
  const usedMetrics = metrics.filter(m => referenced.has(m.id))

  return { goals, metrics: usedMetrics }
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24)
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Local fallback: very conservative. Extract short lines as goals, create a
// single generic "progress" metric so the UI has something to render.
function localParseGoals(text) {
  const lines = text
    .split(/\r?\n|[,;]/)
    .map(s => s.trim())
    .map(s => s.replace(/^[-•*–—]\s+/, ''))
    .map(s => s.replace(/^\d+[.)]\s+/, ''))
    .map(s => s.replace(/^(i want to |i would like to |i'd like to |help me |i need to )/i, ''))
    .filter(s => s && s.length >= 3 && s.length < 80)

  const cleaned = dedupe(lines.map(s => s.toLowerCase())).slice(0, 8)

  if (cleaned.length === 0) return { goals: [], metrics: [] }

  // Single catch-all metric so the check-in isn't empty.
  const metric = {
    id: 'm-progress-0',
    name: 'progress',
    label: 'Progress',
    direction: 'up',
    low: 'worse',
    high: 'better',
    icon: '•',
    color: colorFromPalette(0),
  }

  const goals = cleaned.map((name, i) => ({
    id: `g-${slugify(name)}-${i}`,
    name,
    metricId: metric.id,
    tracked: true,
    priority: i + 1,
    note: null,
  }))

  return { goals, metrics: [metric] }
}

function dedupe(arr) {
  const seen = new Set()
  const out = []
  for (const v of arr) {
    const k = v.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out
}

// ===================================================================
// Onboarding: stack parsing
// ===================================================================
//
// Input: a free-text message ranging from a short list ("I take magnesium
// and vitamin D") to a full health document. Output: an array of
// intervention drafts suitable for pre-filling the stack confirmation view.
//
// Return shape: { interventions: [ { name, type, dose, frequency,
//   status, startDate, endDate, notes } ], offline?: boolean }
//
// The confirmation screen is the user's chance to uncheck or edit anything
// we got wrong, so the parser should err on the side of being inclusive.
export async function parseStackText({ userText }) {
  const text = (userText || '').trim()
  if (!text) return { interventions: [] }

  try {
    const apiResponse = await callAI({
      model: MODEL,
      max_tokens: STACK_MAX_TOKENS,
      system: buildStackSystemPrompt(),
      messages: [{ role: 'user', content: text }],
    })

    // If the model hit the max_tokens ceiling its JSON is almost certainly
    // truncated — bail out with a clear reason so the UI can show it.
    if (apiResponse?.stop_reason === 'max_tokens') {
      console.warn('parseStackText: response truncated at max_tokens')
      return { interventions: localParseStack(text), offline: true, reason: 'truncated' }
    }

    const raw = extractText(apiResponse)
    const parsed = extractJSON(raw)
    const items = Array.isArray(parsed?.interventions) ? parsed.interventions : []
    const cleaned = items.map(normalizeParsedIntervention).filter(Boolean)
    if (cleaned.length) return { interventions: cleaned }

    console.warn('parseStackText: AI returned no parsable items, using local fallback. Raw:', raw?.slice(0, 500))
    return { interventions: localParseStack(text), offline: true, reason: 'no-items' }
  } catch (err) {
    console.warn('parseStackText: AI failed, using local fallback', err)
    return { interventions: localParseStack(text), offline: true, reason: 'error' }
  }
}

function buildStackSystemPrompt() {
  const typeList = INTERVENTION_TYPES.map(t => `"${t.key}"`).join(', ')
  return `You are helping a user import their health stack into a tracking app.

The user will send anything from a one-line list to a detailed multi-paragraph health document. Your job is to extract every distinct intervention they're doing — active or previously stopped — and return them as structured JSON.

Types of interventions (use these exact values):
${typeList}
- supplement: vitamins, minerals, nootropics, herbals (e.g. magnesium, l-theanine, ashwagandha)
- medication: prescription or OTC pharmaceuticals (e.g. trintellix, lexapro, ibuprofen daily)
- habit: recurring behaviors (e.g. cold showers, morning sunlight, meditation)
- exercise: physical activity (e.g. running, strength training, yoga)
- therapy: clinical or psychological (e.g. CBT, EMDR, ketamine therapy)
- diet: eating patterns (e.g. low-FODMAP, keto, intermittent fasting)
- device: tools worn or used (e.g. oura ring, red light, CPAP)
- other: everything else that doesn't fit the above

Response shape (JSON only, no prose, no code fences):
{
  "interventions": [
    {
      "name": "string (human-readable name)",
      "type": "<one of the keys above>",
      "dose": "string|null (e.g. '400mg', '5g', '20 min', '2 capsules'; null if unknown or n/a)",
      "frequency": "Daily|2x daily|3x daily|Weekly|As needed|...",
      "status": "active|stopped",
      "startDate": "YYYY-MM-DD|null (null if the user didn't give one)",
      "endDate": "YYYY-MM-DD|null",
      "notes": "short string|null (short context like 'for anxiety', 'before bed')"
    }
  ]
}

Rules:
1. Extract EVERY intervention mentioned — do not skip items because they seem minor.
2. Mark items the user says they stopped, discontinued, or no longer take as status="stopped".
3. If dose or frequency isn't given, use null for dose and "Daily" as a reasonable default for frequency.
4. If the user mentions a start date in any format, normalize to YYYY-MM-DD. If no date is given, use null.
5. Names should be human-readable Title Case, not shouting or lowercase.
6. Keep notes short — prefer context like "for anxiety" or "with coffee" over long explanations.
7. Never invent interventions the user didn't mention.

Respond now with JSON only.`
}

function normalizeParsedIntervention(item) {
  if (!item || !item.name) return null
  const types = new Set(INTERVENTION_TYPES.map(t => t.key))
  const type = types.has(item.type) ? item.type : 'other'
  return {
    name: String(item.name).trim(),
    type,
    dose: item.dose && String(item.dose).trim() ? String(item.dose).trim() : null,
    frequency: item.frequency && String(item.frequency).trim() ? String(item.frequency).trim() : 'Daily',
    status: item.status === 'stopped' ? 'stopped' : 'active',
    startDate: isISODate(item.startDate) ? item.startDate : null,
    endDate: isISODate(item.endDate) ? item.endDate : null,
    notes: item.notes && String(item.notes).trim() ? String(item.notes).trim() : null,
  }
}

function isISODate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function localParseStack(text) {
  // Offline fallback: one item per non-empty line only.
  // We deliberately do NOT split on commas or semicolons — prose like
  // "I run, I lift, I meditate" would explode into fragments. The AI path
  // is the primary route; this is just a safety net so the user ends up
  // with something editable rather than nothing.
  //
  // Rules:
  // - split on newlines only
  // - strip leading bullet markers (-, •, *, –, —, digits+dot)
  // - skip section headers (lines ending with ":")
  // - skip empty / too-long lines (likely paragraphs, not items)
  // - skip obvious prose (contains a period mid-sentence)
  const lines = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .map(s => s.replace(/^[-•*–—]\s+/, ''))
    .map(s => s.replace(/^\d+[.)]\s+/, ''))
    .filter(Boolean)

  const items = []
  for (const line of lines) {
    if (line.length > 140) continue           // too long — probably prose
    if (/:\s*$/.test(line)) continue          // section header
    // prose heuristic: contains a period followed by space + lowercase word
    if (/\.\s+[a-z]/.test(line)) continue
    items.push(line)
  }

  return items.map(name => ({
    name,
    type: 'other',
    dose: null,
    frequency: 'Daily',
    status: 'active',
    startDate: null,
    endDate: null,
    notes: null,
  }))
}
