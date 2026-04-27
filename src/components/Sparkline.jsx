// Tiny canvas sparkline for the Goals screen.
// Renders a 30-day trend line (solid for daily, dotted+dots for periodic).
// Props:
//   data     — array of numbers (or nulls for missing days)
//   color    — stroke color
//   periodic — if true, draw dashed line with dots at each data point
//   width    — CSS width (default 100)
//   height   — CSS height (default 32)

import { useRef, useEffect } from 'react'

export default function Sparkline({ data = [], color = '#888', periodic = false, width = 100, height = 32 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Filter to non-null entries with their original index
    const points = data
      .map((v, i) => (v != null ? { v, i } : null))
      .filter(Boolean)

    if (points.length < 2) return

    const vals = points.map(p => p.v)
    const mn = Math.min(...vals)
    const mx = Math.max(...vals)
    const range = mx - mn || 1
    const pad = 4

    const x = (i) => pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = (v) => height - pad - ((v - mn) / range) * (height - pad * 2)

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (periodic) {
      ctx.setLineDash([3, 3])
    }

    ctx.beginPath()
    points.forEach((p, idx) => {
      idx === 0 ? ctx.moveTo(x(p.i), y(p.v)) : ctx.lineTo(x(p.i), y(p.v))
    })
    ctx.stroke()
    ctx.setLineDash([])

    // Draw dots
    if (periodic) {
      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(x(p.i), y(p.v), 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
    } else {
      // Just the last point
      const last = points[points.length - 1]
      ctx.beginPath()
      ctx.arc(x(last.i), y(last.v), 2.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }, [data, color, periodic, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block', flexShrink: 0 }}
    />
  )
}
