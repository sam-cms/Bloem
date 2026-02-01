import { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  stream: MediaStream | null
  isActive: boolean
  width?: number
  height?: number
  barCount?: number
  accentColor?: string
}

export default function AudioVisualizer({
  stream,
  isActive,
  width = 200,
  height = 40,
  barCount = 32,
  accentColor = '#00ff88',
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

      const barWidth = (width / barCount) * 0.7
      const gap = (width / barCount) * 0.3
      const centerY = height / 2

      for (let i = 0; i < barCount; i++) {
        // Map bar index to frequency data (skip very low frequencies)
        const dataIndex = Math.floor((i / barCount) * (bufferLength * 0.8)) + 2
        const value = dataArray[dataIndex] || 0
        
        // Normalize and add minimum height
        const normalizedValue = value / 255
        const barHeight = Math.max(2, normalizedValue * (height * 0.9))

        const x = i * (barWidth + gap)
        const y = centerY - barHeight / 2

        // Gradient from accent color with varying opacity
        const alpha = 0.4 + normalizedValue * 0.6
        ctx.fillStyle = accentColor + Math.round(alpha * 255).toString(16).padStart(2, '0')
        
        // Draw rounded bar
        const radius = barWidth / 2
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, radius)
        ctx.fill()
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
  }, [stream, isActive, width, height, barCount, accentColor])

  if (!isActive) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  )
}
