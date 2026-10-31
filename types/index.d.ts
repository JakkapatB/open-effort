export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Language = 'th' | 'en'

/** How clear the plan of a request is. */
export type Clarity = 'clear' | 'goal' | 'unclear'

/** How much implementation a request asks for. */
export type Size = 'none' | 'small' | 'borderline' | 'large'

/** A family of Claude models, least capable first. */
export type ModelTier = 'haiku' | 'sonnet' | 'opus' | 'fable'

/** The readings Haiku takes from a new request. */
export type Score = {
  clarity: Clarity
  isHard: boolean
  isRisky: boolean
  size: Size
  /** How sure Haiku is of its readings, 0 to 100; absent from scores kept before it was asked. */
  confidence?: number
  /** The least capable model family that does this work well, in Haiku's reading; absent when it named none. */
  model?: ModelTier
  /** Whether the message only answers Claude or goes on with the work under way, rather than asking for new work. */
  continues?: boolean
}

/** A part of the Main Flow, in order. */
export type Stage = 'grill' | 'spec' | 'tickets' | 'implement' | 'review' | 'retro'

/** A rung of the ladder: an effort, and whether it runs on Fable 5.1. */
export type Rung = { effort: Effort; isFable: boolean }

/** The task under way. */
export type Task = {
  score: Score | null
  /** Its starting point: the score's effort or the stage's; null for the session's own. */
  effort: Effort | null
  /** The rung a stall moved it to; null at its starting point. */
  climbed: Rung | null
  /** Failing checks in a row on the rung it stands on. */
  fails: number
  /** Whether it reached Fable 5.1, which it keeps to its end. */
  isOnFable: boolean
  /** Whether it stalled at the top and Claude was told to ask the person. */
  isAtLadderEnd: boolean
  /** The Main Flow stage it is in; null in normal mode. */
  stage: Stage | null
  /** Whether the mod asked the person whether to take the Main Flow: only then may Claude's stage tool start it. */
  isFlowInvited: boolean
  /** The model the person chose for this task when the mod offered a more capable one; null for the session's. */
  model: string | null
  /** The model family offered, awaiting the person's answer; null when none is. */
  modelOffer: ModelTier | null
  /** The ticket Claude works in the implement stage, by its number; null when none. */
  ticket: string | null
}

/**
 * A running sub-agent: the effort its requests carry, the effort its stalls climbed it to, its failing checks in a
 * row, and whether it is of a built-in type the mod sets, the only kind it climbs.
 */
export type SubAgent = {
  effort: Effort | null
  climbed: Effort | null
  fails: number
  isClimbable: boolean
  /** The ticket it works, when Claude handed it one in the implement stage; absent otherwise. */
  ticket?: string
  /** The model family it runs on, when a ticket set it or its climbs moved it; absent: as it started. */
  tier?: ModelTier
}

/** What a ticket names for itself: its `Model:` and `Effort:` lines, or Haiku's reading of it when it has none. */
export type TicketSetting = { tier?: ModelTier; effort: Effort }

/** The language picked in the pane; auto follows Claude Code's own setting. */
export type LanguageChoice = 'auto' | Language

/**
 * The mod's switch for this machine, and this project's, which wins when set (null: follows the machine); and the
 * Main Flow's two switches, the same way.
 */
export type Switches = { machine: boolean; project: boolean | null; flowMachine: boolean; flowProject: boolean | null }

/** The project the session works in: its repository's root (or the folder), and the root's last part. */
export type Project = { root: string; name: string }

/** How a turn's effort was chosen: from the score, or by the Main Flow's stage. */
export type Mode = 'normal' | 'main-flow'

/** What one model request of a turn went out with. */
export type Sent = { effort: Effort; model: string }

/** The current turn as it runs: what its requests went out with, and the climbs made in it. */
export type TurnLog = { sent: Sent[]; climbs: number }

/** One finished turn in a project's history; it never holds what the person typed. */
export type HistoryEntry = {
  at: number
  mode: Mode
  score: Score | null
  /** The Main Flow stage the turn ended in; null in normal mode. */
  stage: Stage | null
  /** The task's starting point when the turn ended. */
  start: Effort | null
  /** The efforts and models its requests went out with, each change once, in order. */
  efforts: Effort[]
  models: string[]
  climbs: number
}

declare module 'claude-code' {
  interface PluginState {
    'open-effort': {
      /** Whether the mod is on, by the switches; off, no hook changes anything. */
      isOn: boolean
      switches: Switches
      /** The project the session works in; null until the session starts. */
      project: Project | null
      languageChoice: LanguageChoice
      /** Spelled out here, as the contract file stands alone: ThemeId in diagrams.ts. */
      themeChoice: 'claude' | 'lime' | 'ocean' | 'rose'
      /** Spelled out here, as the contract file stands alone: FlowModel in policy.ts. */
      flowModel: 'frontier' | 'fable' | 'session'
      /** The project's finished turns, oldest first. */
      history: HistoryEntry[]
      /** When each of the band's steps first showed (bandKeys), so only new ones animate in. */
      seen: Record<string, number>
      /** The sub-agents working now, by id. */
      running: string[]
      /** What the mod last saw, for its report tool: how the last score went, and the last request's own effort and model. */
      seenLast: { score: string; effort: string; model: string; starts: number; haikuCalls?: number; view?: string }
      /** The session's sub-agents by id, the latest ones kept. */
      agents: Record<string, SubAgent>
      /** Tickets handed to sub-agents not yet seen running, by the Agent call's description. */
      handed: Record<string, { ticket: string } & TicketSetting>
      /** Counts new tasks, so a late score applies only to the task it was asked for. */
      scoring: number
      /** Whether the surface can put an agent's transcript in view; false once it said it draws no main view. */
      canView: boolean
      /** Whether a prompt's score is still on its way: its requests go out at the session's own effort meanwhile. */
      isScoring: boolean
      /** The Main Flow skills this session lacks; empty when Matt Pocock's skills are installed. */
      missing: string[]
      turnLog: TurnLog
      /** The effort the main session's last request carried, before the mod changed it; null until one is seen. */
      sessionEffort: Effort | null
      /** The model the main session's last request named before the mod changed it; null until one is seen. */
      sessionModel: string | null
      /** The language the band and pane speak. */
      language: Language
      /** The task under way. */
      task: Task
    }
  }
}
