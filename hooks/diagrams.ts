import type { HistoryEntry, Stage, Task } from '../types'
import { STAGES } from './main-flow'
import { EFFORTS, isFable } from './policy'
import { modelName } from './words'

/** How a step stands: done, in effect now, needing attention, on Fable 5.1, at the ladder's end, or idle. */
export type StepState = 'done' | 'active' | 'alert' | 'violet' | 'red' | 'idle'

/** One step of the band: what the mod did or does, its value, and for the effort a meter of the ladder. */
export type Step = {
  title: string
  value: string
  state: StepState
  meter?: { at: number; isFable: boolean }
  /** How much the step matters when room is short: the lowest leave first. */
  rank?: number
  /** Whether the work is happening at this step now: only its link runs. */
  isWorking?: boolean
  /** Whether the step has just appeared: only a new step pops in. */
  isNew?: boolean
  /** More to the title, shown only when the card has room for it: it never widens the card. */
  aside?: string
  /** A loop back into this step, drawn over it: checks failing (the work goes round again), or a climb just made. */
  loop?: Loop
}

/**
 * A loop over a step, from its right back into its mark: amber while checks fail, lit for a climb just made. A climb's
 * loop `isLeaving`: it fades away by itself, and the flow is back to its plain shape.
 */
export type Loop = { label: string; tone: 'alert' | 'brand' | 'violet'; isNew: boolean; isLeaving?: boolean }

/**
 * What the band shows for a task, as keys: a key that was not there before is a step that just appeared, so only it
 * animates in, and a redraw that changes nothing else shows the band still.
 */
export function bandKeys(task: Task): string[] {
  return [
    `head:${task.stage ?? 'read'}`,
    `effort:${task.stage ?? ''}:${task.effort ?? ''}`,
    ...(task.isAtLadderEnd ? ['end'] : []),
    ...(task.climbed ? [`climb:${task.climbed.effort}:${task.climbed.isFable}`] : []),
    ...(task.fails > 0 && !task.isAtLadderEnd ? [`fail:${task.fails}`] : []),
    ...(task.stage ? ['track', `stage:${task.stage}`] : []),
  ]
}

/** A diagram drawn at a fixed height, as wide as its content; `anchor` is where a branch leaves it, when it has one. */
export type Drawing = { source: string; width: number; height: number; anchor?: number; anchorLeft?: number }

// Dark first, as a workflow builder's canvas: dark cards, dashed connectors with joints, an accent in Claude's orange. The image
// follows a light theme through its own media rule.
const BASE_STYLE = `<style>
text{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}
.card{fill:#1c1c1f;stroke:#34343a}.card.on{stroke:#d97757}
.tile{fill:#2a2a30}.tile.brand{fill:#d97757}.tile.violet{fill:#8b5cf6}.tile.red{fill:#ef4444}
.icon{fill:#e4e4e7;font-size:11px;font-weight:700}.icon.brand{fill:#ffffff}.icon.violet,.icon.red{fill:#fff}
.label{fill:#8a8a93;font-size:9.5px}.value{fill:#f4f4f5;font-size:11.5px;font-weight:600}
.link{stroke:#4a4a52;stroke-width:1.2;stroke-dasharray:3 3;fill:none}.run{animation:flow .6s linear infinite}@keyframes flow{to{stroke-dashoffset:-6}}
.pop{transform-box:fill-box;transform-origin:center;animation:pop .45s cubic-bezier(.34,1.56,.64,1) both}
@keyframes pop{0%{opacity:0;transform:translateY(8px) scale(.82)}100%{opacity:1;transform:none}}
.fade{animation:fade .4s ease both}@keyframes fade{from{opacity:0}to{opacity:1}}
.glow{animation:glow 1.8s ease-in-out .5s infinite}@keyframes glow{50%{stroke-width:3;stroke-opacity:.45}}
.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 1.2s ease-in-out infinite}@keyframes pulse{50%{opacity:.35;transform:scale(1.35)}}
@media (prefers-reduced-motion:reduce){.pop,.fade,.glow,.run,.pulse,.leave{animation:none}}.link.on{stroke:#d97757}
.joint{fill:#1c1c1f;stroke:#4a4a52}.joint.on{stroke:#d97757}
.card.active{stroke:#d97757}.card.alert{stroke:#eab308}.card.violet{stroke:#8b5cf6}.card.red{stroke:#ef4444}
.mark{fill:#2a2a30}.mark.done,.mark.active{fill:#d97757}.mark.alert{fill:#eab308}.mark.violet{fill:#8b5cf6}.mark.red{fill:#ef4444}
.markText{fill:#a1a1aa;font-size:10px;font-weight:700}.markText.done,.markText.active,.markText.alert{fill:#ffffff}.markText.violet,.markText.red{fill:#fff}
.value.dim{fill:#c4c4cc}.arrow{stroke:#4a4a52;stroke-width:1.4;fill:none}.arrow.on{stroke:#d97757}
.tick{fill:#34343a}.tick.fill{fill:#7c3f2c}.tick.on{fill:#d97757}.tick.violet{fill:#8b5cf6}
.bar{fill:#34343a}.bar.start{fill:#7c3f2c}.bar.on{fill:#d97757}.bar.violet{fill:#8b5cf6}.bar.amber{fill:#eab308}.bar.shift{fill:#52525b}.hit:hover rect{opacity:.85}
.loop{fill:none;stroke-width:1.4;stroke-dasharray:3 3}.loop.alert{stroke:#eab308}.loop.brand{stroke:#d97757}.loop.violet{stroke:#8b5cf6}
.loopHead{fill:none;stroke-width:1.4}.loopHead.alert{stroke:#eab308}.loopHead.brand{stroke:#d97757}.loopHead.violet{stroke:#8b5cf6}
.loopTag{fill:#1c1c1f;stroke-width:1}.loopTag.alert{stroke:#eab308}.loopTag.brand{stroke:#d97757}.loopTag.violet{stroke:#8b5cf6}
.loopText{font-size:9px;font-weight:600}.loopText.alert{fill:#fde047}.loopText.brand{fill:#d97757}.loopText.violet{fill:#c4b5fd}
.leave{animation:leave 2.4s ease forwards}@keyframes leave{0%{opacity:0}12%,65%{opacity:1}100%{opacity:0}}.axis{stroke:#2a2a30}
@media (prefers-color-scheme:light){
.card{fill:#fff;stroke:#e4e4e7}.card.on{stroke:#c15f3c}.tile{fill:#f4f4f5}.tile.brand{fill:#d97757}
.icon{fill:#27272a}.label{fill:#71717a}.value{fill:#18181b}
.link{stroke:#d4d4d8}.link.on{stroke:#c15f3c}.joint{fill:#fff;stroke:#d4d4d8}.joint.on{stroke:#c15f3c}
.card.active{stroke:#c15f3c}.mark{fill:#f4f4f5}.mark.done,.mark.active{fill:#d97757}.value.dim{fill:#3f3f46}.arrow{stroke:#d4d4d8}.arrow.on{stroke:#c15f3c}.loopTag{fill:#fff}.loopText.brand{fill:#a4472a}.loopText.alert{fill:#a16207}.loop.brand,.loopHead.brand,.loopTag.brand{stroke:#c15f3c}.tick{fill:#e4e4e7}.tick.fill{fill:#f3d3c5}.tick.on{fill:#d97757}.bar{fill:#e4e4e7}.bar.on{fill:#d97757}.axis{stroke:#f4f4f5}}
</style>`

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The mod's colour themes: the accent and its shades, and the warning colour kept apart from the accent. */
export type ThemeId = 'claude' | 'lime' | 'ocean' | 'rose'

export type Theme = {
  /** The accent, on dark and light. */
  accent: string
  /** The accent's stroke on light. */
  strong: string
  /** A dim accent fill on dark, and on light. */
  dim: string
  dimLight: string
  /** The accent's text on light. */
  textLight: string
  /** Text on the accent. */
  on: string
  /** Failing checks: stroke, text on dark, text on light. */
  alert: string
  alertText: string
  alertLight: string
}

export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  claude: { accent: '#d97757', strong: '#c15f3c', dim: '#7c3f2c', dimLight: '#f3d3c5', textLight: '#a4472a', on: '#ffffff', alert: '#eab308', alertText: '#fde047', alertLight: '#a16207' },
  lime: { accent: '#c6f432', strong: '#65a30d', dim: '#5b6b1f', dimLight: '#d9f99d', textLight: '#4d7c0f', on: '#16190a', alert: '#f59e0b', alertText: '#fbbf24', alertLight: '#b45309' },
  ocean: { accent: '#38bdf8', strong: '#0284c7', dim: '#1e4f66', dimLight: '#bae6fd', textLight: '#0369a1', on: '#082f49', alert: '#eab308', alertText: '#fde047', alertLight: '#a16207' },
  rose: { accent: '#f472b6', strong: '#db2777', dim: '#6b2a4b', dimLight: '#fbcfe8', textLight: '#be185d', on: '#500724', alert: '#eab308', alertText: '#fde047', alertLight: '#a16207' },
}

export const THEME_IDS: readonly ThemeId[] = ['claude', 'lime', 'ocean', 'rose']

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

// The style is written in the Claude theme's colours; another theme swaps them, once per theme.
const STYLES = new Map<ThemeId, string>()
function styleOf(id: ThemeId): string {
  const known = STYLES.get(id)
  if (known) return known
  const t = THEMES[id]
  const swaps: Readonly<Record<string, string>> = {
    '#d97757': t.accent,
    '#c15f3c': t.strong,
    '#7c3f2c': t.dim,
    '#f3d3c5': t.dimLight,
    '#a4472a': t.textLight,
    '#ffffff': t.on,
    '#eab308': t.alert,
    '#fde047': t.alertText,
    '#a16207': t.alertLight,
  }
  const style = BASE_STYLE.replace(/#[0-9a-f]{6}/g, hex => swaps[hex] ?? hex)
  STYLES.set(id, style)
  return style
}

let theme: ThemeId = 'claude'

/** Draws from now on in a theme: the band and the pane set theirs as they draw. */
export function useTheme(id: ThemeId): void {
  theme = id
}

function drawing(width: number, height: number, body: string): Drawing {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${styleOf(theme)}${body}</svg>`
  return { source, width, height }
}

/** How wide a run of text is drawn, near enough for laying out cards. */
function textWidth(text: string, size: number): number {
  return Math.ceil(text.length * size * 0.58)
}

/** `text` cut with an ellipsis to fit `px` at font `size`. */
function fit(text: string, size: number, px: number): string {
  if (textWidth(text, size) <= px) return text
  const n = Math.max(1, Math.floor(px / (size * 0.58)) - 1)
  return `${text.slice(0, n)}…`
}

const HEIGHT = 46
const ARROW = 48
/** The room a loop takes above its card. */
const LOOP = 36

/**
 * A loop over the card at (`x`, `y`) `w` wide: up from its right, along over its top with the loop's word in a tag,
 * and down into its mark. It runs while the work goes round.
 */
function loopArc(loop: Loop, x: number, y: number, w: number, isRunning: boolean): string {
  const from = x + w - 30
  const to = x + 16
  const top = y - 18
  const label = fit(loop.label, 9, Math.max(20, from - to - 40))
  const tag = textWidth(label, 9) + 16
  const mid = Math.max(to + tag / 2 + 8, Math.min(from - tag / 2 - 8, (from + to) / 2))
  const cls = loop.isLeaving ? ' class="leave"' : loop.isNew ? ' class="fade"' : ''
  return [
    `<g${cls}>`,
    `<path class="loop ${loop.tone}${isRunning && !loop.isLeaving ? ' run' : ''}" d="M${from} ${y + 3} V${top + 6} Q${from} ${top} ${from - 6} ${top} H${to + 6} Q${to} ${top} ${to} ${top + 6} V${y + 4}"/>`,
    `<path class="loopHead ${loop.tone}" d="M${to - 4} ${y - 1} L${to} ${y + 4} L${to + 4} ${y - 1}"/>`,
    `<rect class="loopTag ${loop.tone}" x="${mid - tag / 2}" y="${top - 7}" width="${tag}" height="14" rx="7"/>`,
    `<text class="loopText ${loop.tone}" x="${mid}" y="${top + 3}" text-anchor="middle">${escape(label)}</text>`,
    '</g>',
  ].join('')
}

const MARK: Readonly<Record<StepState, string>> = { done: '✓', active: '●', alert: '!', violet: 'F', red: '■', idle: '·' }

function stepWidth(step: Step): number {
  const meter = step.meter ? 6 * 9 + 14 : 0
  return 34 + Math.max(textWidth(step.title, 9.5), textWidth(step.value, 12)) + meter + 12
}

function card(st: Step, x: number, y: number, delay = 0, w = stepWidth(st)): string {
  const lit = st.state !== 'idle' && st.state !== 'done'
  const mid = y + HEIGHT / 2
  // The room the words have: right of the mark, left of the meter. A card too narrow for both drops its meter.
  // The words come first: the meter shows only when the title still fits beside it.
  const hasMeter = !!st.meter && w - 34 - (6 * 9 + 14) - 8 >= textWidth(st.title, 9.5)
  const room = w - 34 - (hasMeter ? 6 * 9 + 14 : 0) - 8
  const parts = [
    `<g${st.isNew ? ` class="pop" style="animation-delay:${delay}ms"` : ''}>`,
    `<rect class="card ${st.state}${st.isWorking && lit ? ' glow' : ''}" x="${x}" y="${y + 3}" width="${w}" height="${HEIGHT - 6}" rx="10"/>`,
    `<circle class="mark ${st.state}" cx="${x + 16}" cy="${mid}" r="9"/>`,
    `<text class="markText ${st.state}" x="${x + 16}" y="${mid + 3.5}" text-anchor="middle">${MARK[st.state]}</text>`,
    `<text class="label" x="${x + 32}" y="${y + 19}">${escape(fit(st.aside && textWidth(`${st.title}  ${st.aside}`, 9.5) <= room ? `${st.title}  ${st.aside}` : st.title, 9.5, room))}</text>`,
    `<text class="value${lit ? '' : ' dim'}" x="${x + 32}" y="${y + 34}">${escape(fit(st.value, 12, room))}</text>`,
  ]
  if (st.meter && hasMeter) {
    const mx = x + w - 12 - 6 * 9
    for (let k = 0; k < 6; k++) {
      const isFableSlot = k === 5
      const on = st.meter.isFable ? isFableSlot : k === st.meter.at
      const filled = st.meter.isFable ? k <= 5 : k <= st.meter.at
      const h = 6 + k * 3
      const cls = on ? (isFableSlot ? 'tick violet' : 'tick on') : filled && !isFableSlot ? 'tick fill' : 'tick'
      parts.push(`<rect class="${cls}" x="${mx + k * 9}" y="${mid + 9 - h}" width="6" height="${h}" rx="2"/>`)
    }
  }
  parts.push('</g>')
  return parts.join('')
}

/** A link into a step: a dashed line and an arrowhead, lit when the step is, running when the step is at work. */
function link(x1: number, y1: number, x2: number, y2: number, st: Step, isRunning: boolean, delay = 0): string {
  const on = st.state === 'idle' ? '' : ' on'
  const run = isRunning && st.isWorking ? ' run' : ''
  const horizontal = y1 === y2
  const head = horizontal
    ? `M${x2 - 5} ${y2 - 4} L${x2} ${y2} L${x2 - 5} ${y2 + 4}`
    : `M${x2 - 4} ${y2 - 5} L${x2} ${y2} L${x2 + 4} ${y2 - 5}`
  return `<g${st.isNew ? ` class="fade" style="animation-delay:${delay}ms"` : ''}><path class="link${on}${run}" d="M${x1} ${y1} ${horizontal ? `H${x2 - 1}` : `V${y2 - 1}`}"/><path class="arrow${on}" d="${head}"/></g>`
}

/**
 * The band's steps as a pipeline that fits `maxWidth`: in a row when there is room; otherwise the least important
 * steps (by `rank`, lowest first) leave, and when even the two that matter most do not fit side by side, they stack.
 * Each card's mark and outline say how it stands; the effort's carries a meter of the ladder. While Claude works
 * (`isRunning`) only the link into the step at work (`isWorking`) runs.
 */
export function stepsSvg(all: readonly Step[], maxWidth: number, isRunning = false, fillTo = 0): Drawing {
  const rowWidth = (ss: readonly Step[]) => ss.reduce((sum, st) => sum + stepWidth(st), 0) + (ss.length - 1) * ARROW + 4
  let steps = [...all]
  while (steps.length > 2 && rowWidth(steps) > maxWidth) {
    const least = steps.reduce((low, st) => ((st.rank ?? 0) < (low.rank ?? 0) ? st : low))
    steps = steps.filter(st => st !== least)
  }
  const parts: string[] = []
  if (rowWidth(steps) <= maxWidth || steps.length === 1) {
    // Spread over `fillTo`: each card grows by the same share, so the flow fills its whole space, with no gap after it.
    const grow = fillTo > 0 ? Math.max(0, (Math.min(fillTo, maxWidth) - rowWidth(steps)) / steps.length) : 0
    let x = 2
    let fresh = 0
    let anchor = 0
    let anchorLeft = 0
    // A loop needs room over the cards; the row moves down by it only while one shows.
    const dy = steps.some(st => st.loop) ? LOOP : 0
    steps.forEach((st, i) => {
      const delay = st.isNew ? fresh++ * 80 : 0
      const w = stepWidth(st) + grow
      if (i > 0) parts.push(link(x - ARROW + 4, dy + HEIGHT / 2, x - 4, dy + HEIGHT / 2, st, isRunning, delay + 40))
      parts.push(card(st, x, dy, delay, w))
      if (st.loop) parts.push(loopArc(st.loop, x, dy + 3, w, isRunning))
      if (i === steps.length - 1) {
        anchor = x + w / 2
        anchorLeft = x
      }
      x += w + ARROW
    })
    return { ...drawing(x - ARROW + 2, dy + HEIGHT, parts.join('')), anchor, anchorLeft }
  }
  // Stacked: one card under the other, joined downward, each as wide as the band.
  const gap = 30
  const full = maxWidth - 4
  let fresh = 0
  let y = 0
  steps.forEach((st, i) => {
    // A card with a loop sits lower, under its loop; its link comes in down the loop's left.
    if (st.loop) y += LOOP
    const delay = st.isNew ? fresh++ * 80 : 0
    if (i > 0) parts.push(link(18, y - gap - (st.loop ? LOOP : 0) + 1, 18, y + 3, st, isRunning, delay + 40))
    parts.push(card(st, 2, y, delay, full))
    if (st.loop) parts.push(loopArc(st.loop, 2, y + 3, full, isRunning))
    y += HEIGHT + gap
  })
  const width = full + 4
  return { ...drawing(width, y - gap, parts.join('')), anchor: 2 + full / 2, anchorLeft: 2 }
}

/**
 * The sub-agents at work, as one node under the step at work: a running stem down from it (`from`) to a pill naming
 * how many work. Their names follow beneath, drawn apart from this, so nothing here has to line up with them.
 */
export function agentsSvg(from: number, width: number, said: string, isNew: boolean): Drawing {
  const label = fit(said, 11, width - 40)
  const pill = Math.min(width - 4, textWidth(label, 11) + 36)
  const x = Math.max(2, Math.min(width - pill - 2, from - pill / 2))
  const top = 22
  const body = [
    `<circle class="joint on" cx="${from}" cy="3" r="3"/>`,
    `<path class="link on run fan" d="M${from} 6 C${from} 14 ${x + pill / 2} 12 ${x + pill / 2} ${top}"/>`,
    `<g${isNew ? ' class="pop"' : ''}>`,
    `<rect class="card active glow" x="${x}" y="${top}" width="${pill}" height="24" rx="12"/>`,
    `<circle class="mark active pulse" cx="${x + 14}" cy="${top + 12}" r="4"/>`,
    `<text class="value" x="${x + 24}" y="${top + 16}" style="font-size:11px">${escape(label)}</text>`,
    '</g>',
  ].join('')
  return drawing(Math.max(width, x + pill + 2), top + 26, body)
}

/**
 * The Main Flow's stages as small pills on a dashed line: those done with a tick, the one in progress lit. Narrow
 * bands show only the stages around the one in progress.
 */
export function stageSvg(stage: Stage, maxWidth: number, fresh: { isTrackNew: boolean; isStageNew: boolean } = { isTrackNew: true, isStageNew: true }): Drawing {
  const at = STAGES.indexOf(stage)
  const widthOf = (name: string) => textWidth(name, 10) + 30
  let first = 0
  let last = STAGES.length - 1
  const span = () => STAGES.slice(first, last + 1).reduce((sum, s) => sum + widthOf(s), 0) + (last - first) * 18 + 4
  while (span() > maxWidth && last - first > 0) {
    if (at - first >= last - at) first += 1
    else last -= 1
  }
  // The track spreads over the band's width: the room left is shared out as wider pills.
  const shown = last - first + 1
  const grow = Math.max(0, (maxWidth - span()) / shown)
  let x = 2
  const parts: string[] = []
  STAGES.slice(first, last + 1).forEach((name, k) => {
    const i = first + k
    const w = widthOf(name) + grow
    // The whole track pops in when it first shows; after that only the stage just started does.
    const pops = fresh.isTrackNew || (fresh.isStageNew && i === at)
    const delay = fresh.isTrackNew ? k * 70 : 0
    if (k > 0) parts.push(`<path class="link${fresh.isTrackNew ? ' fade' : ''}${i <= at ? ' on' : ''}" style="animation-delay:${delay + 35}ms" d="M${x - 18} 13 H${x}"/>`)
    const tone = i === at ? 'brand' : 'gray'
    parts.push(
      `<g${pops ? ` class="pop" style="animation-delay:${delay}ms"` : ''}>`,
      `<rect class="card${i === at ? ' on glow' : ''}" x="${x}" y="2" width="${w}" height="22" rx="11"/>`,
      `<circle class="tile ${tone}" cx="${x + 12}" cy="13" r="7"/>`,
      `<text class="icon ${tone}" x="${x + 12}" y="16.5" text-anchor="middle" style="font-size:8.5px">${i < at ? '✓' : i + 1}</text>`,
      `<text class="${i === at ? 'value' : 'label'}" x="${x + 24}" y="17" style="font-size:10px">${name}</text>`,
      '</g>',
    )
    x += w + 18
  })
  return drawing(x - 16, 26, parts.join(''))
}

/** What the history charts are told about each turn: its tooltip, and the words for the legend and axes. */
export type ChartWords = { tooltip: (entry: HistoryEntry) => string; climbed: string; changed: string; fable: string; started: string; turns: string; models: string }

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max', 'Fable'] as const

/** A turn's level on the chart's scale: its effort, or the Fable band above max when it ran on Fable 5.1. */
function levelOf(effort: string, onFable: boolean): number {
  return onFable ? 5 : Math.max(0, EFFORTS.indexOf(effort as (typeof EFFORTS)[number]))
}

/**
 * The history as charts that answer questions, `width` wide:
 * - over time, one bar per turn from the effort it started at to the highest it reached, the climb in amber and
 *   Fable 5.1 in violet, effort levels named on the left and times along the bottom; hovering a bar names the turn;
 * - beneath, where turns start: per effort level, how many started there and how many of those climbed.
 */
function sum(efforts: Map<string, { all: number }>): number {
  return [...efforts.values()].reduce((n, c) => n + c.all, 0)
}

export function historySvg(entries: readonly HistoryEntry[], width: number, words: ChartWords): Drawing {
  const left = 58
  const plotW = Math.max(60, width - left - 8)
  const rows = LEVELS.length
  const rowH = 14
  const top = 8
  const plotH = rows * rowH
  const room = Math.max(6, Math.floor(plotW / 9))
  const recent = entries.slice(-room)
  const step = plotW / Math.max(recent.length, 1)
  // Bars widen with the room, so a few turns still fill the chart rather than sit as slivers.
  const barW = Math.max(3, Math.min(28, step * 0.62))
  const yOf = (level: number) => top + (rows - 1 - level) * rowH + rowH / 2
  const parts: string[] = []
  LEVELS.forEach((name, level) => {
    const y = yOf(level)
    parts.push(`<line class="axis" x1="${left}" x2="${left + plotW}" y1="${y}" y2="${y}"/>`)
    parts.push(`<text class="label" x="${left - 6}" y="${y + 3}" text-anchor="end">${name}</text>`)
  })
  recent.forEach((e, i) => {
    const onFable = e.models.some(isFable)
    const startLevel = levelOf(e.start ?? e.efforts[0] ?? 'medium', false)
    const peak = Math.max(...e.efforts.map(f => levelOf(f, false)), startLevel, onFable ? 5 : 0)
    const x = left + i * step + (step - barW) / 2
    const y1 = yOf(peak) - 4
    const y0 = yOf(startLevel) + 4
    // Amber only for a real climb (failing checks); an effort changed mid-turn for another reason, such as a new
    // prompt scored again, is a gray range.
    const climbCls = onFable ? 'bar violet' : e.climbs > 0 ? 'bar amber' : 'bar shift'
    const tip = `<title>${escape(words.tooltip(e))}</title>`
    parts.push(`<g class="hit">${tip}<rect x="${x - 2}" y="${top}" width="${barW + 4}" height="${plotH}" fill="transparent"/>`)
    if (peak > startLevel) parts.push(`<rect class="${climbCls}" x="${x}" y="${y1}" width="${barW}" height="${yOf(startLevel) - y1}" rx="2"/>`)
    parts.push(`<rect class="bar${i === recent.length - 1 ? ' on' : ' start'}" x="${x}" y="${yOf(startLevel) - 4}" width="${barW}" height="${y0 - (yOf(startLevel) - 4)}" rx="2"/></g>`)
  })
  // Times along the bottom: the first, the middle and the last turn shown.
  const axisY = top + plotH + 12
  const ticks = recent.length > 2 ? [0, Math.floor(recent.length / 2), recent.length - 1] : recent.map((_, i) => i)
  for (const i of ticks) {
    const e = recent[i]
    if (!e) continue
    const d = new Date(e.at)
    const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    // The first and last labels keep inside the chart's edges.
    const at = left + i * step + step / 2
    const anchor = at + 15 > width ? 'end' : at - 15 < 0 ? 'start' : 'middle'
    parts.push(`<text class="label" x="${anchor === 'end' ? width - 1 : at}" y="${axisY}" text-anchor="${anchor}">${label}</text>`)
  }
  // Model and effort together: each model a heading with its turns, and under it a bar for each effort the turns
  // started at on it, its climbed share in amber. A turn that reached Fable 5.1 counts there too, at its last effort.
  const pairs = new Map<string, Map<string, { all: number; climbed: number }>>()
  const count = (model: string, effort: string, climbed: boolean) => {
    const efforts = pairs.get(model) ?? new Map<string, { all: number; climbed: number }>()
    const c = efforts.get(effort) ?? { all: 0, climbed: 0 }
    efforts.set(effort, { all: c.all + 1, climbed: c.climbed + (climbed ? 1 : 0) })
    pairs.set(model, efforts)
  }
  for (const e of entries) {
    const first = e.models[0]
    const start = e.start ?? e.efforts[0]
    if (first && start) count(modelName(first), start, e.climbs > 0)
    const last = e.efforts[e.efforts.length - 1]
    if (e.models.slice(1).some(isFable) && last) count('Fable 5.1', last, false)
  }
  const most = Math.max(1, ...[...pairs.values()].flatMap(m => [...m.values()].map(c => c.all)))
  // Each bar's count beside it; a narrow chart says a climb with a short ↑, and the bars leave room for the longest.
  const isNarrow = width - left < 200
  const countText = (c: { all: number; climbed: number }) => `${c.all}${c.climbed ? (isNarrow ? ` ↑${c.climbed}` : ` · ${c.climbed} ${words.climbed}`) : ''}`
  const longest = Math.max(0, ...[...pairs.values()].flatMap(m => [...m.values()].map(c => textWidth(countText(c), 9.5))))
  const distW = Math.max(6, width - left - 9 - longest)
  let y = axisY + 22
  parts.push(`<text class="label" x="0" y="${y - 8}">${escape(fit(words.models, 9.5, width - 2))}</text>`)
  const order = [...pairs.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))
  for (const [model, efforts] of order) {
    const tone = model === 'Fable 5.1' ? 'violet' : 'start'
    parts.push(`<rect class="bar ${tone}" x="0" y="${y - 1}" width="8" height="8" rx="2"/><text class="value" x="12" y="${y + 7}" style="font-size:10.5px">${escape(model)}</text><text class="label" x="${12 + textWidth(model, 10.5) + 6}" y="${y + 7}">${sum(efforts)}</text>`)
    y += 15
    for (const effort of EFFORTS) {
      const c = efforts.get(effort)
      if (!c) continue
      const w = (c.all / most) * distW
      const cw = (c.climbed / most) * distW
      parts.push(`<text class="label" x="${left - 6}" y="${y + 8}" text-anchor="end">${effort}</text>`)
      parts.push(`<rect class="bar${tone === 'violet' ? ' violet' : ''}" x="${left}" y="${y}" width="${Math.max(w, 2)}" height="9" rx="2"/>`)
      if (cw > 0) parts.push(`<rect class="bar amber" x="${left}" y="${y}" width="${cw}" height="9" rx="2"/>`)
      parts.push(`<text class="label" x="${left + Math.max(w, 2) + 5}" y="${y + 8}">${escape(countText(c))}</text>`)
      y += 13
    }
    y += 6
  }
  // Legend: its keys in a row, wrapping to a new line when the chart is narrow.
  // A narrow chart starts the legend at its left edge rather than under the bars.
  let legendY = y + 8
  const legendLeft = width - left < 200 ? 0 : left
  let lx = legendLeft
  const keys: [string, string][] = [['start', words.turns], ['amber', words.climbed], ['shift', words.changed], ['violet', words.fable]]
  for (const [cls, label] of keys) {
    const w = 12 + textWidth(label, 11) + 18
    if (lx > legendLeft && lx + w > width) {
      lx = legendLeft
      legendY += 16
    }
    parts.push(`<rect class="bar ${cls}" x="${lx}" y="${legendY - 7}" width="8" height="8" rx="2"/><text class="label" x="${lx + 12}" y="${legendY}">${escape(fit(label, 9.5, width - lx - 14))}</text>`)
    lx += w
  }
  return drawing(width, legendY + 6, parts.join(''))
}
