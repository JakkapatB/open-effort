import type { Clarity, Effort, HistoryEntry, Language, Score, Stage } from '../types'
import type { ThemeId } from './diagrams'
import { FAILS_TO_STALL, isFable } from './policy'
import type { FlowModel } from './policy'
import { isUnsure } from './score'

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
  | { kind: 'climbOffer' }

export type Words = {
  commandDescription: string
  /**
   * The band: the flow (by `flow`, its name) and stage if in one, the effort in use (null: the session's own, not seen
   * yet), on Fable 5.1 or not, and why.
   */
  band: (effort: Effort | null, isOnFable: boolean, why: Why, stage: Stage | null, flow: string) => string
  /** Why the effort is what it is, alone: the band's reason. */
  reason: (why: Why) => string
  /** The band's steps: what the mod did and does, and the values it shows. */
  steps: StepWords
  status: (isOn: boolean) => string
  onlyPerson: string
  /** Only the person can ask for their own flow. */
  onlyPersonFlow: string
  /** Said as Claude starts on the project's own flow, and when its prompt could not go in. */
  flowWriting: string
  flowFailed: string
  pane: PaneWords
}

export type StepWords = {
  read: string
  effort: string
  noScore: string
  /** The effort's value before the session's own is seen. */
  own: string
  stage: string
  /** The first step on work done directly once Claude used a stage's skill on it: Matt's, or a project's own flow's. */
  skill: string
  flowSkill: string
  atEnd: string
  climbed: string
  failed: string
  stopped: string
  /** A climb at the top effort of the task's model, waiting for the person's answer about the model one family up. */
  asking: string
  /** The effort's title after a climb: where it climbed from. */
  from: (effort: Effort) => string
  /** The ticket Claude works in the stage that works tickets. */
  ticket: (number: string) => string
  agents: string
  agentsAt: (n: number) => string
  /** Opening an agent's transcript was refused, and why. */
  viewDenied: (reason: string) => string
  /** This app cannot open an agent from the band at all. */
  viewUnavailable: string
}

export type PaneWords = {
  switches: string
  useHere: (name: string) => string
  advanced: string
  defaults: string
  on: string
  off: string
  mainFlow: string
  flow: string
  /** Which flow the project uses: Matt Pocock's, built in, or its own from `file`. */
  flowSource: (name: string, file: string | null) => string
  /** The project's flow file cannot be used, and why. */
  flowProblem: (problem: string) => string
  /** How to have Claude write the project's own flow. */
  flowHint: string
  missing: (skills: readonly string[]) => string
  install: string
  updates: string
  installed: (version: string) => string
  check: string
  checking: string
  upToDate: (version: string) => string
  newerOut: (version: string) => string
  /** The header card when a newer version is out: the newest, and the one installed. */
  newVersion: (latest: string, current: string) => string
  whatChanged: string
  releases: string
  updateNow: string
  updating: string
  updated: (version: string) => string
  reload: string
  reloadNote: string
  updateFailed: (reason: string) => string
  cannotRun: string
  runThis: string
  notChecked: string
  unreached: string
  daily: string
  dailyNote: string
  language: string
  auto: string
  theme: string
  flowModel: string
  flowModels: Readonly<Record<FlowModel, string>>
  /** What each flow model costs: its limits, said where it is picked. */
  flowModelLimits: Readonly<Record<FlowModel, string>>
  themes: Readonly<Record<ThemeId, string>>
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
  climbOffer: string
}

function scoreWords(p: Phrases, score: Score): string {
  return [p.clarity[score.clarity], score.isHard ? p.hard : '', score.isRisky ? p.risky : '', isUnsure(score) ? p.unsure : ''].filter(Boolean).join(' · ')
}

function reasonOf(p: Phrases) {
  return (why: Why): string =>
    why.kind === 'scored' ? scoreWords(p, why.score)
    : p[why.kind]
}

function bandOf(p: Phrases) {
  return (effort: Effort | null, isOnFable: boolean, why: Why, stage: Stage | null, flow: string): string => {
    if (!effort) return `open-effort · ${p.noEffort}`
    const reason = reasonOf(p)(why)
    return `open-effort · ${stage ? `${flow}: ${stage} · ` : ''}${isOnFable ? 'Fable 5.1 · ' : ''}effort ${effort} · ${reason}`
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
  climbOffer: 'top effort on this model: Claude asks you about the next model up',
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
  climbOffer: 'effort สูงสุดของโมเดลนี้แล้ว: Claude จะถามคุณเรื่องโมเดลที่เก่งกว่า',
}

const EN: Words = {
  commandDescription: 'open-effort: open its pane; "on" or "off" switches it for this project; "flow" has Claude write your own flow',
  band: bandOf(EN_PHRASES),
  reason: reasonOf(EN_PHRASES),
  steps: {
    read: 'Haiku read it',
    effort: 'Effort',
    noScore: 'no score',
    own: 'session',
    stage: 'Main Flow',
    skill: "Matt's skill · direct",
    flowSkill: 'Flow skill · direct',
    atEnd: 'asking you',
    climbed: 'Climbed',
    failed: 'Check failed',
    stopped: 'Stopped',
    asking: 'Asking you',
    from: e => `↑ from ${e}`,
    ticket: n => `ticket ${n}`,
    agents: 'Sub-agents',
    agentsAt: n => `${n} working`,
    viewDenied: reason => `Could not open the agent: ${reason}`,
    viewUnavailable: "This app can't open an agent from the band. Open it from the app's own task list.",
  },
  status: isOn => (isOn ? 'on for this project.' : 'off for this project: it changes nothing here until you turn it on with /open-effort on.'),
  onlyPerson: 'only the person can switch it, by typing /open-effort on or off.',
  onlyPersonFlow: 'only the person can ask for their own flow, by typing /open-effort flow.',
  flowWriting: 'Claude will ask you about your flow, then write .claude/open-effort.json once you agree.',
  flowFailed: 'open-effort could not hand Claude the flow request. Ask Claude yourself to write .claude/open-effort.json, or type /open-effort flow again.',
  pane: {
    switches: 'Switch',
    useHere: name => `Use in this project · ${name}`,
    advanced: 'Advanced · this machine',
    defaults: 'The default for projects you have not switched yourself.',
    on: 'On',
    off: 'Off',
    mainFlow: 'Main Flow',
    flow: 'Flow',
    flowSource: (name, file) => (file ? `${name} · from ${file}` : "Matt Pocock's Main Flow · built in"),
    flowProblem: problem => `The flow file can't be used: ${problem}. The flow is off until it is fixed.`,
    flowHint: 'Type /open-effort flow to have Claude write your own.',
    missing: skills => `Missing skills: ${skills.join(', ')}`,
    install: 'Install them from a terminal, then reload plugins:',
    updates: 'Updates',
    installed: v => `Installed: ${v}`,
    check: 'Check now',
    checking: 'checking…',
    upToDate: v => `${v} is the newest`,
    newerOut: v => `${v} is out`,
    newVersion: (latest, current) => `${latest} is out · you have ${current}`,
    whatChanged: 'What changed:',
    releases: 'Releases on GitHub',
    updateNow: 'Update now',
    updating: 'updating…',
    updated: v => `Updated to ${v}.`,
    reload: 'Reload now',
    reloadNote: 'Reload runs the new version in this session, and may start the prompt cache afresh. A new session runs it too.',
    updateFailed: reason => `The update did not finish: ${reason}`,
    cannotRun: 'Claude Code could not be run from here',
    runThis: 'Run this in a terminal instead:',
    notChecked: 'Not checked yet',
    unreached: "Couldn't reach GitHub just now",
    daily: 'Check for updates daily',
    dailyNote: 'Once a day the mod reads the newest version number from GitHub. Nothing about your work is sent.',
    language: 'Language',
    theme: 'Theme',
    flowModel: 'Model for the flow',
    flowModels: { frontier: 'Frontier · Opus 5.5', fable: 'Fable 5.1', session: "Session's model" },
    flowModelLimits: {
      frontier: 'Every stage runs on Opus 5.5. A session on a smaller model switches once as the flow starts: the prompt cache starts afresh, and it costs more than Sonnet. A session on Fable 5.1 stays on it.',
      fable: 'Every stage runs on Fable 5.1, the most capable model: the most expensive per token, and its turns run longer. The prompt cache starts afresh as the flow starts.',
      session: "The flow stays on the session's model: no switch, the cache holds. On a smaller model, planning and review stages may come out weaker.",
    },
    themes: { claude: 'Claude', lime: 'Lime', ocean: 'Ocean', rose: 'Rose' },
    auto: 'Auto',
    history: turns => `History · ${turns} turns`,
    noHistory: 'No turns yet.',
    entry: entryLine(EN_PHRASES, { read: 'Haiku:', none: 'no score, the session\'s own', stage: 'Flow:' }, e => `start ${e}`),
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
  commandDescription: 'open-effort: เปิด pane พิมพ์ "on" หรือ "off" เพื่อเปิดหรือปิดในโปรเจกต์นี้ พิมพ์ "flow" ให้ Claude ช่วยเขียน flow ของคุณเอง',
  band: bandOf(TH_PHRASES),
  reason: reasonOf(TH_PHRASES),
  steps: {
    read: 'Haiku อ่านแล้ว',
    effort: 'Effort',
    noScore: 'ไม่มีคะแนน',
    own: 'session',
    stage: 'Main Flow',
    skill: 'skill ของ Matt · ทำตรงๆ',
    flowSkill: 'skill ของ flow · ทำตรงๆ',
    atEnd: 'จะถามคุณ',
    climbed: 'ไต่ขึ้น',
    failed: 'check ไม่ผ่าน',
    stopped: 'หยุด',
    asking: 'ถามคุณ',
    from: e => `↑ จาก ${e}`,
    ticket: n => `ticket ${n}`,
    agents: 'Sub-agent',
    agentsAt: n => `${n} ตัวกำลังทำ`,
    viewDenied: reason => `เปิด agent ไม่ได้: ${reason}`,
    viewUnavailable: 'แอปนี้เปิด agent จากแถบนี้ไม่ได้ ให้เปิดจากรายการ task ของแอปแทน',
  },
  status: isOn => (isOn ? 'เปิดอยู่ในโปรเจกต์นี้' : 'ปิดอยู่ในโปรเจกต์นี้: จะไม่เปลี่ยนอะไรจนกว่าคุณจะพิมพ์ /open-effort on'),
  onlyPerson: 'เปิดหรือปิดได้เฉพาะผู้ใช้ โดยพิมพ์ /open-effort on หรือ off',
  onlyPersonFlow: 'ขอ flow ของตัวเองได้เฉพาะผู้ใช้ โดยพิมพ์ /open-effort flow',
  flowWriting: 'Claude จะถามคุณเรื่อง flow แล้วเขียน .claude/open-effort.json เมื่อคุณตกลง',
  flowFailed: 'open-effort ส่งคำขอเรื่อง flow ให้ Claude ไม่สำเร็จ ลองบอก Claude เองให้เขียน .claude/open-effort.json หรือพิมพ์ /open-effort flow อีกครั้ง',
  pane: {
    switches: 'สวิตช์',
    useHere: name => `ใช้ในโปรเจกต์นี้ · ${name}`,
    advanced: 'ขั้นสูง · เครื่องนี้',
    defaults: 'ค่าเริ่มต้นของโปรเจกต์ที่คุณยังไม่ได้ตั้งเอง',
    on: 'เปิด',
    off: 'ปิด',
    mainFlow: 'Main Flow',
    flow: 'Flow',
    flowSource: (name, file) => (file ? `${name} · จาก ${file}` : 'Main Flow ของ Matt Pocock · มีมาให้'),
    flowProblem: problem => `ใช้ไฟล์ flow ไม่ได้: ${problem} flow จะปิดอยู่จนกว่าจะแก้ไฟล์`,
    flowHint: 'พิมพ์ /open-effort flow ให้ Claude ช่วยเขียน flow ของคุณเอง',
    missing: skills => `ยังไม่มี skill: ${skills.join(', ')}`,
    install: 'ติดตั้งจาก terminal แล้ว reload plugins:',
    updates: 'อัปเดต',
    installed: v => `ที่ติดตั้งอยู่: ${v}`,
    check: 'เช็คตอนนี้',
    checking: 'กำลังเช็ค…',
    upToDate: v => `${v} เป็นเวอร์ชันล่าสุดแล้ว`,
    newerOut: v => `มี ${v} แล้ว`,
    newVersion: (latest, current) => `มี ${latest} แล้ว · ที่ติดตั้งอยู่ ${current}`,
    whatChanged: 'เปลี่ยนอะไรบ้าง:',
    releases: 'หน้า Releases บน GitHub',
    updateNow: 'อัปเดตเลย',
    updating: 'กำลังอัปเดต…',
    updated: v => `อัปเดตเป็น ${v} แล้ว`,
    reload: 'Reload เลย',
    reloadNote: 'Reload จะใช้เวอร์ชันใหม่ใน session นี้ทันที และอาจทำให้ prompt cache เริ่มใหม่ ถ้าเปิด session ใหม่ก็ได้เวอร์ชันใหม่เหมือนกัน',
    updateFailed: reason => `อัปเดตไม่สำเร็จ: ${reason}`,
    cannotRun: 'เรียก Claude Code จากตรงนี้ไม่ได้',
    runThis: 'ให้รันคำสั่งนี้ใน terminal แทน:',
    notChecked: 'ยังไม่ได้เช็ค',
    unreached: 'ติดต่อ GitHub ไม่ได้ในตอนนี้',
    daily: 'เช็คอัปเดตวันละครั้ง',
    dailyNote: 'วันละครั้ง mod จะอ่านเลขเวอร์ชันล่าสุดจาก GitHub โดยไม่ส่งข้อมูลงานของคุณออกไป',
    language: 'ภาษา',
    theme: 'ธีมสี',
    flowModel: 'โมเดลของ flow',
    flowModels: { frontier: 'Frontier · Opus 5.5', fable: 'Fable 5.1', session: 'ตามโมเดลของ session' },
    flowModelLimits: {
      frontier: 'ทุก stage ใช้ Opus 5.5 ถ้า session ใช้โมเดลที่เล็กกว่า จะเปลี่ยนครั้งเดียวตอนเข้า flow: prompt cache เริ่มใหม่ และแพงกว่า Sonnet ถ้า session ใช้ Fable 5.1 อยู่แล้วจะใช้ต่อ',
      fable: 'ทุก stage ใช้ Fable 5.1 โมเดลที่เก่งที่สุด: แพงที่สุดต่อ token และแต่ละ turn ใช้เวลานานกว่า prompt cache เริ่มใหม่ตอนเข้า flow',
      session: 'ใช้โมเดลของ session ตลอด flow: ไม่เปลี่ยนโมเดล cache ไม่เสีย แต่ถ้าเป็นโมเดลที่เล็กกว่า stage วางแผนและ review อาจออกมาด้อยกว่า',
    },
    themes: { claude: 'Claude', lime: 'มะนาว', ocean: 'ฟ้า', rose: 'ชมพู' },
    auto: 'อัตโนมัติ',
    history: turns => `ประวัติ · ${turns} turn`,
    noHistory: 'ยังไม่มี turn',
    entry: entryLine(TH_PHRASES, { read: 'Haiku:', none: 'ไม่มีคะแนน ใช้ของ session', stage: 'Flow:' }, e => `เริ่ม ${e}`),
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
