/**
 * Cat sprite voice notifier, host half: a process-wide service that listens
 * to key agent / tool / workflow / goal progress events and drains queued
 * notices through the `poll` Remote for the browser half.
 * @module @deepseek-ai/dsh-client-ui-kitty
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-goal'
import type {} from '@deepseek-ai/dsh-workflow'
import type {} from '@deepseek-ai/dsh-tools'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/cordis' {
  interface Context {
    kitty: KittyService
  }
}

/** Cap on queued voice notices before the oldest are dropped. */
const MAX_QUEUE = 200
/** Minimum gap between step-progress announcements while a turn runs. */
const STEP_ANNOUNCE_INTERVAL_MS = 10_000

/** Per-session bookkeeping for the current turn. */
interface TurnProgress {
  steps: number
  lastStepAnnounce: number
}

/** Cat voice-notice service backed by live agent/workflow/goal progress events. */
export class KittyService extends TypertRemoteService {
  private readonly queue: string[] = []
  private readonly turns = new Map<string, TurnProgress>()
  private readonly lastGoalRound = new Map<string, number>()

  constructor(ctx: Context) {
    super(ctx, 'kitty')

    ctx.on('agent/status', (payload) => {
      if (!this.isRootAgent(payload.agent)) return
      const id = agentId(payload.agent)
      if (payload.status === 'running') {
        this.turns.set(id, { steps: 0, lastStepAnnounce: 0 })
        this.push('任务开始处理')
      } else if (payload.status === 'idle') {
        const progress = this.turns.get(id)
        const steps = progress === undefined ? 0 : progress.steps
        this.turns.delete(id)
        this.push(steps > 0 ? `任务处理完成，共 ${steps} 步` : '任务处理完成')
      }
    })

    ctx.on('tools/result', (exec) => {
      const agent = exec.agent
      if (!this.isRootAgent(agent)) return
      const id = agentId(agent)
      const now = Date.now()
      const progress = this.turns.get(id) ?? { steps: 0, lastStepAnnounce: 0 }
      progress.steps += 1
      this.turns.set(id, progress)
      if (now - progress.lastStepAnnounce >= STEP_ANNOUNCE_INTERVAL_MS) {
        progress.lastStepAnnounce = now
        const tool = typeof exec.name === 'string' && exec.name.length > 0 ? exec.name : undefined
        this.push(tool !== undefined
          ? `处理中…已完成 ${progress.steps} 步（${tool}）`
          : `处理中…已完成 ${progress.steps} 步`)
      }
    })

    ctx.on('workflow/phase', (_info, title) => {
      if (typeof title === 'string' && title.length > 0) this.push(`工作流阶段：${title}`)
    })

    ctx.on('workflow/end', () => {
      this.push('工作流完成')
    })

    ctx.on('goal/changed', (payload) => {
      const change = payload?.change
      if (change === undefined || change === null) return
      const operation = change.operation
      const goal = change.goal
      const rounds = goal?.roundsStarted
      const maxRounds = goal?.maxGoalRounds
      const pct = (typeof rounds === 'number' && typeof maxRounds === 'number' && maxRounds > 0)
        ? Math.min(100, Math.round((rounds / maxRounds) * 100))
        : undefined
      if (operation === 'complete') {
        this.push(pct !== undefined ? `目标已完成，用了 ${rounds} 轮` : '目标已完成')
      } else if (operation === 'block') {
        this.push('目标受阻')
      } else if (operation === 'pause') {
        this.push('目标已暂停')
      } else if (operation === 'resume') {
        this.push('目标已恢复')
      } else if (operation === 'create') {
        this.push('目标已建立')
      } else if (typeof rounds === 'number' && rounds > 0 && pct !== undefined) {
        const id = agentId(payload.agent)
        if (this.lastGoalRound.get(id) !== rounds) {
          this.lastGoalRound.set(id, rounds)
          this.push(`目标进度：第 ${rounds}/${maxRounds} 轮（${pct}%）`)
        }
      }
    })

    ctx.on('agent/error', (payload) => {
      if (!this.isRootAgent(payload.agent)) return
      this.push(`处理出错，第 ${payload.turn} 轮`)
    })
  }

  /** Drain all pending voice notices for the caller. */
  @Remote('poll')
  poll(): string[] {
    return this.queue.splice(0, this.queue.length)
  }

  private push(text: string): void {
    this.queue.push(text)
    if (this.queue.length > MAX_QUEUE) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE)
    }
  }

  /** Restrict notices to top-level (non-subagent) agents. */
  private isRootAgent(agent: unknown): boolean {
    if (agent === null || typeof agent !== 'object') return true
    if (agentId(agent) === '') return true
    try {
      const agents = this.ctx.get('agents') as { roots?: () => unknown[] } | undefined
      if (agents === undefined || typeof agents.roots !== 'function') return true
      const roots = agents.roots()
      if (!Array.isArray(roots)) return true
      for (const root of roots) {
        if (root !== null && typeof root === 'object' && agentId(root) === agentId(agent)) {
          return true
        }
      }
      return false
    } catch {
      return true
    }
  }
}

/** Read a stable identity off an agent-shaped record, preferring `id` then `session.id`. */
function agentId(record: unknown): string {
  if (record === null || typeof record !== 'object') return ''
  const r = record as { id?: unknown; session?: { id?: unknown } }
  if (typeof r.id === 'string') return r.id
  const session = r.session
  if (session !== null && typeof session === 'object') {
    const id = (session as Record<string, unknown>).id
    if (typeof id === 'string') return id
  }
  return ''
}

/** Default export so the Cordis Loader instantiates this Service class. */
export default KittyService
