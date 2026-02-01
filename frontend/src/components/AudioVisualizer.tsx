import { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  stream: MediaStream | null
  isActive: boolean
  width?: number
  height?: number
  barCount?: number
  accentColor?: string
  symmetrical?: boolean
}

export default function AudioVisualizer({
  stream,
  isActive,
  width = 200,
  height = 40,
  barCount = 32,
  accentColor = '#00ff88',
  symmetrical = false,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream || !isActive) {
      // Cleanup when not active
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      // Clear canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    // Create audio context and analyser
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.7

    // Connect stream to analyser
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const draw = () => {
      if (!analyserRef.current || !isActive) return

      analyserRef.current.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, width, height)

      // For symmetrical mode, we draw from center outward (half bars on each side)
      const halfBars = symmetrical ? Math.floor(barCount / 2) : barCount
      const totalBars = symmetrical ? halfBars * 2 : barCount
      const barWidth = (width / totalBars) * 0.7
      const gap = (width / totalBars) * 0.3
      const centerY = height / 2
      const centerX = width / 2

      for (let i = 0; i < halfBars; i++) {
        // Map bar index to frequency data (skip very low frequencies)
        const dataIndex = Math.floor((i / halfBars) * (bufferLength * 0.6)) + 2
        const value = dataArray[dataIndex] || 0
        
        // Normalize and add minimum height
        const normalizedValue = value / 255
        const barHeight = Math.max(2, normalizedValue * (height * 0.85))

        // Gradient from accent color with varying opacity
        const alpha = 0.5 + normalizedValue * 0.5
        ctx.fillStyle = accentColor + Math.round(alpha * 255).toString(16).padStart(2, '0')
        
        const radius = barWidth / 2

        if (symmetrical) {
          // Draw mirrored bars from center
          const offsetFromCenter = i * (barWidth + gap) + gap / 2
          
          // Right side
          const xRight = centerX + offsetFromCenter
          ctx.beginPath()
          ctx.roundRect(xRight, centerY - barHeight / 2, barWidth, barHeight, radius)
          ctx.fill()
          
          // Left side (mirrored)
          const xLeft = centerX - offsetFromCenter - barWidth
          ctx.beginPath()
          ctx.roundRect(xLeft, centerY - barHeight / 2, barWidth, barHeight, radius)
          ctx.fill()
        } else {
          const x = i * (barWidth + gap)
          ctx.beginPath()
          ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, radius)
          ctx.fill()
        }
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream, isActive, width, height, barCount, accentColor, symmetrical])

  if (!isActive) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  )
}
