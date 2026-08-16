/**
 * The floating cat sprite: click to toggle voice, mouth animates while
 * speaking, and a speech bubble shows the latest progress notice.
 */

import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

const CAT_CSS = `
.dsh-kitty-root{position:fixed;right:22px;bottom:22px;z-index:9999;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.dsh-kitty-bubble{max-width:250px;padding:8px 12px;border-radius:14px 14px 14px 3px;background:rgba(34,34,38,.92);color:#fff;font-size:13px;line-height:1.45;box-shadow:0 6px 18px rgba(0,0,0,.22);pointer-events:none;text-align:center;animation:dsh-kitty-bubble-in .24s ease}
@keyframes dsh-kitty-bubble-in{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.dsh-kitty-btn{position:relative;width:78px;height:78px;padding:0;border:none;background:transparent;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 6px 16px rgba(0,0,0,.28));transition:transform .16s ease}
.dsh-kitty-btn:hover{transform:translateY(-3px) scale(1.05)}
.dsh-kitty-btn:active{transform:scale(.94)}
.dsh-kitty-svg{display:block;width:78px;height:78px}
.dsh-kitty-mouth{transform-origin:40px 61px}
.dsh-kitty-speak .dsh-kitty-mouth{animation:dsh-kitty-talk .32s ease-in-out infinite alternate}
.dsh-kitty-speak{animation:dsh-kitty-bob .5s ease-in-out infinite alternate}
@keyframes dsh-kitty-talk{from{transform:scaleY(.35)}to{transform:scaleY(1.15)}}
@keyframes dsh-kitty-bob{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-4px) rotate(2deg)}}
.dsh-kitty-dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#9aa0a6;border:2px solid #fff;box-sizing:border-box;transition:background .2s ease}
.dsh-kitty-dot-on{background:#34c759}
.dsh-kitty-label{font-size:11px;color:#fff;background:rgba(34,34,38,.72);padding:1px 9px;border-radius:10px;pointer-events:none}
`

export interface KittySpriteProps {
  poll: () => Promise<RemoteResult<string[]>>
  interval: (callback: () => void, delay: number) => () => void
}

export function KittySprite({ poll, interval }: KittySpriteProps) {
  const [voiceOn, setVoiceOn] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const enabledRef = useRef(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = CAT_CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  function speak(text: string): boolean {
    const synth = window.speechSynthesis
    const Utterance = window.SpeechSynthesisUtterance
    if (!synth || !Utterance) return false
    try {
      synth.cancel()
      const u = new Utterance(text)
      u.lang = 'zh-CN'
      u.rate = 1.02
      u.pitch = 1.12
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      synth.speak(u)
      return true
    } catch {
      setSpeaking(false)
      return false
    }
  }

  const toggle = (): void => {
    const next = !enabledRef.current
    enabledRef.current = next
    setVoiceOn(next)
    if (next) {
      const ok = speak('语音提醒已开启')
      setBubble(ok ? '语音提醒已开启' : '已开启（浏览器不支持语音）')
    } else {
      try { window.speechSynthesis.cancel() } catch { /* ignore */ }
      setSpeaking(false)
      setBubble(null)
    }
  }

  useEffect(() => {
    const doPoll = (): void => {
      void poll().then((result) => {
        if (!result.ok || !Array.isArray(result.value) || result.value.length === 0) return
        const latest = result.value[result.value.length - 1]
        if (latest === undefined) return
        setBubble(latest)
        if (enabledRef.current) speak(latest)
        setTimeout(() => setBubble(null), 4200)
      }).catch(() => { /* ignore */ })
    }
    return interval(doPoll, 1100)
  }, [poll, interval])

  const btnCls = 'dsh-kitty-btn' + (speaking ? ' dsh-kitty-speak' : '')
  const dotCls = 'dsh-kitty-dot' + (voiceOn ? ' dsh-kitty-dot-on' : '')

  return (
    <div className="dsh-kitty-root">
      {bubble !== null ? <div className="dsh-kitty-bubble">{bubble}</div> : null}
      <button
        type="button"
        className={btnCls}
        title={voiceOn ? '点击关闭语音提醒' : '点击开启语音提醒'}
        aria-label={voiceOn ? '关闭语音提醒' : '开启语音提醒'}
        onClick={toggle}
      >
        <CatFace />
        <span className={dotCls} />
      </button>
      <span className="dsh-kitty-label">{voiceOn ? '语音开' : '语音关'}</span>
    </div>
  )
}

function CatFace() {
  return (
    <svg className="dsh-kitty-svg" viewBox="0 0 80 80" aria-hidden="true">
      <polygon points="14,34 18,6 42,20" fill="#F3A16B" />
      <polygon points="66,34 62,6 38,20" fill="#F3A16B" />
      <polygon points="21,28 23,14 34,22" fill="#F9A8B0" />
      <polygon points="59,28 57,14 46,22" fill="#F9A8B0" />
      <circle cx="40" cy="48" r="27" fill="#F3A16B" />
      <ellipse cx="27" cy="58" rx="4.5" ry="2.6" fill="#F9A8B0" />
      <ellipse cx="53" cy="58" rx="4.5" ry="2.6" fill="#F9A8B0" />
      <ellipse cx="30" cy="46" rx="4.2" ry="5.6" fill="#3B2F2F" />
      <ellipse cx="50" cy="46" rx="4.2" ry="5.6" fill="#3B2F2F" />
      <circle cx="31.6" cy="44" r="1.5" fill="#FFFFFF" />
      <circle cx="51.6" cy="44" r="1.5" fill="#FFFFFF" />
      <polygon points="37,55 43,55 40,59" fill="#E8807F" />
      <path className="dsh-kitty-mouth" d="M34,61 Q37,65 40,61 Q43,65 46,61" fill="none" stroke="#5A4641" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke="#5A4641" strokeWidth="1.4" strokeLinecap="round">
        <line x1="16" y1="54" x2="3" y2="50" />
        <line x1="15" y1="58" x2="2" y2="58" />
        <line x1="16" y1="62" x2="3" y2="66" />
        <line x1="64" y1="54" x2="77" y2="50" />
        <line x1="65" y1="58" x2="78" y2="58" />
        <line x1="64" y1="62" x2="77" y2="66" />
      </g>
    </svg>
  )
}
