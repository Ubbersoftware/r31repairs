'use client'
import { useRef, useState } from 'react'
import styles from './SignaturePad.module.css'

export function SignaturePad({ onConfirm }: { onConfirm: (pngDataUrl: string) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)

  function ctx() {
    const c = canvasRef.current!
    const g = c.getContext('2d')!
    g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = '#111'
    return g
  }
  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function down(e: React.PointerEvent) {
    drawing.current = true
    const g = ctx(); const p = pos(e); g.beginPath(); g.moveTo(p.x, p.y)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const g = ctx(); const p = pos(e); g.lineTo(p.x, p.y); g.stroke(); setHasInk(true)
  }
  function up() { drawing.current = false }
  function clear() {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasInk(false)
  }

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} width={320} height={160} aria-label="Signature pad"
        className={styles.canvas}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className={styles.actions}>
        <button type="button" onClick={clear}>Clear</button>
        <button type="button" disabled={!hasInk || busy}
          onClick={async () => {
            setBusy(true)
            try { await onConfirm(canvasRef.current!.toDataURL('image/png')) } finally { setBusy(false) }
          }}>
          {busy ? 'Saving…' : 'Confirm signature'}
        </button>
      </div>
    </div>
  )
}
