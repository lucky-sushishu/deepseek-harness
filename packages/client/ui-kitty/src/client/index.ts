/**
 * Cat sprite voice notifier, browser half: a floating overlay cat that speaks
 * key task progress, toggled by click.
 */

import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/cordis-plugin-timer'
import type {} from '@deepseek-ai/dsh-client-ui-kitty/remote'
import { KittySprite } from './KittySprite.tsx'

export const inject = ['slots', 'timer', 'remote', 'remote.kitty']

export function apply(ctx: ClientContext): void {
  const poll = () => ctx.remote.kitty.poll()
  const interval = (callback: () => void, delay: number) => ctx.interval(callback, delay)

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'kitty-voice',
    order: 1000,
    label: '语音小精灵',
  }, () => createElement(KittySprite, { poll, interval })))
}
