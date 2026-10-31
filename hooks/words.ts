import type { Clarity, Effort, HistoryEntry, Language, Score, Stage } from '../types'
import { FAILS_TO_STALL, isFable } from './policy'

/** Thai when Claude Code's `language` setting names Thai (`thai`, `th`, `ไทย`, any case), else English. */
export function languageOf(setting: unknown): Language {
  const named = typeof setting === 'string' ? setting.trim().toLowerCase() : ''
  return named === 'thai' || named === 'th' || named === 'ไทย' ? 'th' : 'en'
}

/** Why the band's effort is what it is. */
export type Why =
  | { kind: 'own' }
  | { kind: 'scored'; score: Score }
  | { kind: 'stage' }
  | { kind: 'climbed' }
  | { kind: 'ladderEnd' }

export type Words = {
  commandDescription: string
  /** The band: the Main Flow stage if in it, the effort in use (null: the session's own, not seen yet), on Fable 5.1 or not, and why. */
  band: (effort: Effort | null, isOnFable: boolean, why: Why, stage: Stage | null) => string
  /** Why the effort is what it is, alone: the band's reason. */
  reason: (why: Why) => string
  /** The band diagram's node titles and edge labels. */
  flow: FlowWords
  /** The band's steps: what the mod did and does, and the values it shows. */
  steps: StepWords
  status: (isOn: boolean) => string
  onlyPerson: string
  pane: PaneWords
}

export type StepWords = {
  read: string
  effort: string
  checks: string
  model: string
  noScore: string
  stage: string
  watching: string
  failing: (n: number) => string
  raised: string
  atEnd: string
  climbed: string
  failed: string
  stopped: string
  /** The effort's title after a climb: where it climbed from. */
  from: (effort: Effort) => string
  /** The ticket Claude works in the implement stage. */
  ticket: (number: string) => string
  agents: string
  agentsAt: (n: number) => string
  /** Opening an agent's transcript was refused, and why. */
  viewDenied: (reason: string) => string
  none: string
}

export type FlowWords = {
  why: string
  start: string
  now: string
  steady: string
  climbed: string
  own: string
}

export type PaneWords = {
  switches: string
  thisMachine: string
  thisProject: (name: string) => string
  useHere: (name: string) => string
  advanced: string
  defaults: string
  machine: (isOn: boolean) => string
  project: (name: string, isOn: boolean | null) => string
  on: string
  off: string
  follow: string
  mainFlow: string
  missing: (skills: readonly string[]) => string
  install: string
  language: string
  auto: string
  theme: string
  themes: Readonly<Record<'claude' | 'lime' | 'ocean' | 'rose', string>>
  history: (turns: number) => string
  noHistory: string
  /** One history entry as a line: its efforts, why, climbs and models (its time stands beside it); never what was typed. */
  entry: (entry: HistoryEntry) => string
  /** A history entry's headline: the efforts its requests went out at, a climb marked. */
  entryTitle: (entry: HistoryEntry) => string
  /** A line over the recent turns: how many climbed and how many reached Fable 5.1. */
  summary: (entries: readonly HistoryEntry[]) => string
  chart: { climbed: string; changed: string; models: string; fable: string; started: string; turns: string }
}

type Phrases = {
  noEffort: string
  own: string
  clarity: Readonly<Record<Clarity, string>>
  hard: string
  risky: string
  unsure: string
  stage: string
  climbed: string
  ladderEnd: string
}

function scoreWords(p: Phrases, score: Score): string {
  const unsure = score.confidence !== undefined && score.confidence < 60
  return [p.clarity[score.clarity], score.isHard ? p.hard : '', score.isRisky ? p.risky : '', unsure ? p.unsure : ''].filter(Boolean).join(' · ')
}

function reasonOf(p: Phrases) {
  return (why: Why): string =>
    why.kind === 'scored' ? scoreWords(p, why.score)
    : p[why.kind]
}

function bandOf(p: Phrases) {
  return (effort: Effort | null, isOnFable: boolean, why: Why, stage: Stage | null): string => {
    if (!effort) return `open-effort · ${p.noEffort}`
    const reason = reasonOf(p)(why)
    return `open-effort · ${stage ? `Main Flow: ${stage} · ` : ''}${isOnFable ? 'Fable 5.1 · ' : ''}effort ${effort} · ${reason}`
  }
}

export function clockTime(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A model as people say it: `claude-opus-5-5` is Opus 5.5; none seen yet is the session's. */
export function modelName(model: string | null): string {
  if (!model) return 'session'
  if (isFable(model)) return 'Fable 5.1'
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  return m && m[1] ? `${m[1][0]?.toUpperCase()}${m[1].slice(1)} ${m[2]}.${m[3]}` : model.replace(/^claude-/, '')
}

function entryLine(p: Phrases, why: { read: string; none: string; stage: string }, started: (effort: Effort) => string) {
  return (e: HistoryEntry): string =>
    [
      e.stage ? `${why.stage} ${e.stage}` : e.score ? `${why.read} ${scoreWords(p, e.score)}` : why.none,
      e.start ? started(e.start) : '',
      e.models.map(modelName).join(' → '),
    ]
      .filter(Boolean)
      .join(' · ')
}

function entryTitleOf(climbed: (n: number) => string) {
  return (e: HistoryEntry): string => `${e.efforts.join(' → ')}${e.climbs > 0 ? `  ↑ ${climbed(e.climbs)}` : ''}`
}

const EN_PHRASES: Phrases = {
  noEffort: "the session's own effort",
  own: "the session's own",
  clarity: { clear: 'clear plan', goal: 'goal known', unclear: 'plan unclear' },
  hard: 'unusually hard',
  risky: 'risky',
  unsure: 'unsure',
  stage: "the stage's effort",
  climbed: `climbed: ${FAILS_TO_STALL} failing checks in a row`,
  ladderEnd: 'at the top: Claude will ask you',
}

const TH_PHRASES: Phrases = {
  noEffort: 'effort ตามที่ session ใช้อยู่',
  own: 'ค่าที่ session ใช้อยู่',
  clarity: { clear: 'แผนชัด', goal: 'รู้เป้าหมาย', unclear: 'แผนยังไม่ชัด' },
  hard: 'ยากพิเศษ',
  risky: 'เสี่ยง',
  unsure: 'ไม่แน่ใจ',
  stage: 'effort ของ stage นี้',
  climbed: `ไต่ขึ้น: check ไม่ผ่าน ${FAILS_TO_STALL} ครั้งติด`,
  ladderEnd: 'สุดบันไดแล้ว: Claude จะถามคุณ',
}

const EN: Words = {
  commandDescription: 'open-effort: open its pane; "on" or "off" switches it for this project',
  band: bandOf(EN_PHRASES),
  reason: reasonOf(EN_PHRASES),
  flow: { why: 'Why', start: 'Start', now: 'Now', steady: 'steady', climbed: 'climbed', own: 'session' },
  steps: {
    read: 'Haiku read it',
    effort: 'Effort',
    checks: 'Checks',
    model: 'Model',
    noScore: 'no score',
    stage: 'Main Flow',
    watching: 'watching',
    failing: n => `${n}/${FAILS_TO_STALL} failing`,
    raised: 'raised',
    atEnd: 'asking you',
    climbed: 'Climbed',
    failed: 'Check failed',
    stopped: 'Stopped',
    from: e => `↑ from ${e}`,
    ticket: n => `ticket ${n}`,
    agents: 'Sub-agents',
    agentsAt: n => `${n} working`,
    viewDenied: reason => `Could not open the agent: ${reason}`,
    none: 'none',
  },
  status: isOn => (isOn ? 'on for this project.' : 'off for this project: it changes nothing here until you turn it on with /open-effort on.'),
  onlyPerson: 'only the person can switch it, by typing /open-effort on or off.',
  pane: {
    switches: 'Switch',
    thisMachine: 'This machine',
    useHere: name => `Use in this project · ${name}`,
    advanced: 'Advanced · this machine',
    defaults: 'The default for projects you have not switched yourself.',
    thisProject: name => `This project · ${name}`,
    machine: isOn => `This machine: ${isOn ? 'on' : 'off'}`,
    project: (name, isOn) => `This project (${name}): ${isOn === null ? 'follows the machine' : isOn ? 'on' : 'off'}`,
    on: 'On',
    off: 'Off',
    follow: 'Follow the machine',
    mainFlow: 'Main Flow',
    missing: skills => `Missing skills: ${skills.join(', ')}`,
    install: 'Install them from a terminal, then reload plugins:',
    language: 'Language',
    theme: 'Theme',
    themes: { claude: 'Claude', lime: 'Lime', ocean: 'Ocean', rose: 'Rose' },
    auto: 'Auto',
    history: turns => `History · ${turns} turns`,
    noHistory: 'No turns yet.',
    entry: entryLine(EN_PHRASES, { read: 'Haiku:', none: 'no score, the session\'s own', stage: 'Main Flow:' }, e => `start ${e}`),
    entryTitle: entryTitleOf(n => `climbed ${n}`),
    chart: { climbed: 'climbed', changed: 'changed mid-turn', models: 'Model · effort the turns started at', fable: 'Fable 5.1', started: 'Where turns start', turns: 'started at' },
    summary: es => {
      const climbs = es.filter(e => e.climbs > 0).length
      const fable = es.filter(e => e.models.some(isFable)).length
      return `${es.length} turns · ${climbs} climbed · ${fable} on Fable 5.1`
    },
  },
}

const TH: Words = {
  commandDescription: 'open-effort: เปิด pane พิมพ์ "on" หรือ "off" เพื่อเปิดหรือปิดในโปรเจกต์นี้',
  band: bandOf(TH_PHRASES),
  reason: reasonOf(TH_PHRASES),
  flow: { why: 'เหตุผล', start: 'เริ่ม', now: 'ตอนนี้', steady: 'คงที่', climbed: 'ไต่ขึ้น', own: 'session' },
  steps: {
    read: 'Haiku อ่านแล้ว',
    effort: 'Effort',
    checks: 'Check',
    model: 'โมเดล',
    noScore: 'ไม่มีคะแนน',
    stage: 'Main Flow',
    watching: 'กำลังดู',
    failing: n => `ไม่ผ่าน ${n}/${FAILS_TO_STALL}`,
    raised: 'ไต่ขึ้นแล้ว',
    atEnd: 'จะถามคุณ',
    climbed: 'ไต่ขึ้น',
    failed: 'check ไม่ผ่าน',
    stopped: 'หยุด',
    from: e => `↑ จาก ${e}`,
    ticket: n => `ticket ${n}`,
    agents: 'Sub-agent',
    agentsAt: n => `${n} ตัวกำลังทำ`,
    viewDenied: reason => `เปิด agent ไม่ได้: ${reason}`,
    none: 'ไม่มี',
  },
  status: isOn => (isOn ? 'เปิดอยู่ในโปรเจกต์นี้' : 'ปิดอยู่ในโปรเจกต์นี้: จะไม่เปลี่ยนอะไรจนกว่าคุณจะพิมพ์ /open-effort on'),
  onlyPerson: 'เปิดหรือปิดได้เฉพาะผู้ใช้ โดยพิมพ์ /open-effort on หรือ off',
  pane: {
    switches: 'สวิตช์',
    thisMachine: 'เครื่องนี้',
    useHere: name => `ใช้ในโปรเจกต์นี้ · ${name}`,
    advanced: 'ขั้นสูง · เครื่องนี้',
    defaults: 'ค่าเริ่มต้นของโปรเจกต์ที่คุณยังไม่ได้ตั้งเอง',
    thisProject: name => `โปรเจกต์นี้ · ${name}`,
    machine: isOn => `เครื่องนี้: ${isOn ? 'เปิด' : 'ปิด'}`,
    project: (name, isOn) => `โปรเจกต์นี้ (${name}): ${isOn === null ? 'ตามเครื่อง' : isOn ? 'เปิด' : 'ปิด'}`,
    on: 'เปิด',
    off: 'ปิด',
    follow: 'ตามเครื่อง',
    mainFlow: 'Main Flow',
    missing: skills => `ยังไม่มี skill: ${skills.join(', ')}`,
    install: 'ติดตั้งจาก terminal แล้ว reload plugins:',
    language: 'ภาษา',
    theme: 'ธีมสี',
    themes: { claude: 'Claude', lime: 'มะนาว', ocean: 'ฟ้า', rose: 'ชมพู' },
    auto: 'อัตโนมัติ',
    history: turns => `ประวัติ · ${turns} turn`,
    noHistory: 'ยังไม่มี turn',
    entry: entryLine(TH_PHRASES, { read: 'Haiku:', none: 'ไม่มีคะแนน ใช้ของ session', stage: 'Main Flow:' }, e => `เริ่ม ${e}`),
    entryTitle: entryTitleOf(n => `ไต่ขึ้น ${n}`),
    chart: { climbed: 'ไต่ขึ้น', changed: 'เปลี่ยนกลาง turn', models: 'โมเดล · effort ที่ turn เริ่ม', fable: 'Fable 5.1', started: 'turn เริ่มที่ระดับไหน', turns: 'เริ่มที่' },
    summary: es => {
      const climbs = es.filter(e => e.climbs > 0).length
      const fable = es.filter(e => e.models.some(isFable)).length
      return `${es.length} turn · ไต่ขึ้น ${climbs} · ใช้ Fable 5.1 ${fable}`
    },
  },
}

export function wordsFor(language: Language): Words {
  return language === 'th' ? TH : EN
}
