import { useEffect, useRef } from 'react'
import { useChartStore } from '@/store'
import { useSMCZones } from '@/hooks'
import { detectSupportResistance, analyzeMarketStructure, calcSMA } from '@/lib'
import { useTradeStore } from '@/store/tradeStore'

/**
 * Chart overlay rendering support/resistance, trend lines, channels, VWAP, etc.
 * Uses canvas for efficient real-time drawing.
 */
export function ChartOverlays() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  const bars = useChartStore((s) => s.bars)

  // Get analysis data
  const smc = useSMCZones({})
  const activeTrade = useTradeStore((s) => s.activeTrade)

  // Map bar index and price to canvas coordinates
  const getPixelCoordinates = (barIndex: number, price: number, dims: { width: number; height: number }) => {
    if (bars.length === 0) return null

    const visibleBars = Math.min(bars.length, 100) // Show last 100 bars
    const startIdx = Math.max(0, bars.length - visibleBars)
    const relativeIdx = barIndex - startIdx

    if (relativeIdx < 0 || relativeIdx >= visibleBars) return null

    const barWidth = dims.width / visibleBars
    const x = (relativeIdx + 0.5) * barWidth

    const visibleBarSlice = bars.slice(startIdx)
    const minPrice = Math.min(...visibleBarSlice.map((b) => b.low))
    const maxPrice = Math.max(...visibleBarSlice.map((b) => b.high))
    const priceRange = maxPrice - minPrice || 1

    const volumeAreaHeight = dims.height * 0.18
    const chartHeight = dims.height - volumeAreaHeight
    const y = chartHeight - ((price - minPrice) / priceRange) * chartHeight

    return { x, y, barWidth, chartHeight }
  }

  // Draw support/resistance levels
  const drawSupportResistance = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const srLevels = detectSupportResistance(bars)
    const supportLevels = srLevels.filter((l) => l.type === 'support').slice(0, 3)
    const resistanceLevels = srLevels.filter((l) => l.type === 'resistance').slice(0, 3)

    // Support levels (green)
    supportLevels.forEach((level, idx) => {
      const coord = getPixelCoordinates(bars.length - 1, level.price, dims)
      if (!coord) return

      ctx.strokeStyle = `rgba(34, 197, 94, ${0.5 - idx * 0.1})`
      ctx.lineWidth = 2 - idx * 0.3
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, coord.y)
      ctx.lineTo(dims.width, coord.y)
      ctx.stroke()

      // Label
      ctx.fillStyle = `rgba(34, 197, 94, 0.8)`
      ctx.font = '11px monospace'
      ctx.fillText(`S${idx + 1}: ${level.price.toFixed(2)}`, 5, coord.y - 3)
    })

    // Resistance levels (red)
    resistanceLevels.forEach((level, idx) => {
      const coord = getPixelCoordinates(bars.length - 1, level.price, dims)
      if (!coord) return

      ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 - idx * 0.1})`
      ctx.lineWidth = 2 - idx * 0.3
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, coord.y)
      ctx.lineTo(dims.width, coord.y)
      ctx.stroke()

      // Label
      ctx.fillStyle = `rgba(239, 68, 68, 0.8)`
      ctx.font = '11px monospace'
      ctx.fillText(`R${idx + 1}: ${level.price.toFixed(2)}`, 5, coord.y - 3)
    })

    ctx.setLineDash([])
  }

  // Draw trend lines from market structure
  const drawTrendLines = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const structure = analyzeMarketStructure(bars)
    if (!structure.trendLines || structure.trendLines.length === 0) return

    structure.trendLines.forEach((line) => {
      const startCoord = getPixelCoordinates(line.startBarIndex, line.startPrice, dims)
      const endCoord = getPixelCoordinates(line.endBarIndex, line.endPrice, dims)

      if (!startCoord || !endCoord) return

      const isUptrend = line.endPrice > line.startPrice
      ctx.strokeStyle = isUptrend ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(startCoord.x, startCoord.y)
      ctx.lineTo(endCoord.x, endCoord.y)
      ctx.stroke()
    })
  }

  // Draw swing highs and lows
  const drawSwingPoints = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const structure = analyzeMarketStructure(bars)
    if (!structure.swings || structure.swings.length === 0) return

    structure.swings.slice(-20).forEach((swing) => {
      const coord = getPixelCoordinates(swing.barIndex, swing.price, dims)
      if (!coord) return

      const isHigh = swing.kind === 'high'
      const color = isHigh ? 'rgba(168, 85, 247, 0.8)' : 'rgba(59, 130, 246, 0.8)'

      // Draw diamond marker
      const size = 4
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(coord.x, coord.y - size)
      ctx.lineTo(coord.x + size, coord.y)
      ctx.lineTo(coord.x, coord.y + size)
      ctx.lineTo(coord.x - size, coord.y)
      ctx.closePath()
      ctx.fill()

      // Label
      ctx.fillStyle = color
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(isHigh ? 'H' : 'L', coord.x, coord.y - 8)
    })
  }

  // Draw VWAP (approximate using 100-bar moving average)
  const drawVWAP = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const vwapValues = calcSMA(bars, 100)

    if (vwapValues.length === 0) return

    const visibleBars = Math.min(bars.length, 100)
    const startIdx = Math.max(0, bars.length - visibleBars)

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()

    let isFirstPoint = true
    for (let i = startIdx; i < bars.length; i++) {
      const vwapValue = vwapValues[i]?.value ?? bars[i].close
      const coord = getPixelCoordinates(i, vwapValue, dims)
      if (!coord) continue

      if (isFirstPoint) {
        ctx.moveTo(coord.x, coord.y)
        isFirstPoint = false
      } else {
        ctx.lineTo(coord.x, coord.y)
      }
    }
    ctx.stroke()

    // Label
    const lastVwapValue = vwapValues[vwapValues.length - 1]?.value ?? bars[bars.length - 1].close
    const lastCoord = getPixelCoordinates(bars.length - 1, lastVwapValue, dims)
    if (lastCoord) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'
      ctx.font = '11px monospace'
      ctx.fillText('VWAP', lastCoord.x + 5, lastCoord.y)
    }
  }

  // Draw fair value gaps
  const drawFairValueGaps = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const zones = smc.zones ?? []
    const fvgs = zones.filter((z: any) => z.type === 'fair-value-gap').slice(0, 5) as any[]

    if (fvgs.length === 0) return

    fvgs.forEach((fvg) => {
      const topCoord = getPixelCoordinates(fvg.barIndex, fvg.topPrice, dims)
      const bottomCoord = getPixelCoordinates(fvg.barIndex, fvg.bottomPrice, dims)

      if (!topCoord || !bottomCoord) return

      ctx.fillStyle = 'rgba(124, 58, 255, 0.15)'
      ctx.fillRect(0, bottomCoord.y, dims.width, topCoord.y - bottomCoord.y)

      // Border
      ctx.strokeStyle = 'rgba(124, 58, 255, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(0, bottomCoord.y, dims.width, topCoord.y - bottomCoord.y)
      ctx.setLineDash([])
    })
  }

  // Draw order blocks
  const drawOrderBlocks = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const zones = smc.zones ?? []
    const orderBlocks = zones.filter((z: any) => z.type === 'order-block').slice(0, 5) as any[]

    if (orderBlocks.length === 0) return

    orderBlocks.forEach((ob) => {
      const topCoord = getPixelCoordinates(ob.barIndex, ob.price + ob.price * 0.005, dims)
      const bottomCoord = getPixelCoordinates(ob.barIndex, ob.price - ob.price * 0.005, dims)

      if (!topCoord || !bottomCoord) return

      const color = ob.bias === 'bullish' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
      const borderColor = ob.bias === 'bullish' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'

      ctx.fillStyle = color
      ctx.fillRect(0, bottomCoord.y, dims.width, topCoord.y - bottomCoord.y)

      ctx.strokeStyle = borderColor
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.strokeRect(0, bottomCoord.y, dims.width, topCoord.y - bottomCoord.y)
      ctx.setLineDash([])
    })
  }

  // Draw liquidity zones
  const drawLiquidity = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    const zones = smc.zones ?? []
    const liquidity = zones.filter((z: any) => z.type === 'liquidity-sweep').slice(0, 5) as any[]

    if (liquidity.length === 0) return

    liquidity.forEach((liq) => {
      const coord = getPixelCoordinates(liq.barIndex, liq.price, dims)
      if (!coord) return

      // Draw zone around liquidity level
      const height = 8
      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)'
      ctx.fillRect(0, coord.y - height / 2, dims.width, height)

      // Markers at sweep points
      ctx.fillStyle = 'rgba(249, 115, 22, 0.8)'
      ctx.beginPath()
      ctx.arc(coord.x, coord.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Draw active trade entry/stop/target
  const drawActiveTrade = (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => {
    if (!activeTrade) return

    // Entry (blue line)
    const entryCoord = getPixelCoordinates(activeTrade.entry.barIndex, activeTrade.entry.price, dims)
    if (entryCoord) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(0, entryCoord.y)
      ctx.lineTo(dims.width, entryCoord.y)
      ctx.stroke()

      // Entry label
      ctx.fillStyle = 'rgba(59, 130, 246, 0.9)'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`ENTRY: ${activeTrade.entry.price.toFixed(2)}`, dims.width - 200, entryCoord.y - 5)

      // Entry point marker
      ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
      ctx.beginPath()
      ctx.arc(entryCoord.x, entryCoord.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Stop Loss (red line)
    const stopCoord = activeTrade.stopLoss ? getPixelCoordinates(activeTrade.stopLoss.barIndex, activeTrade.stopLoss.price, dims) : null
    if (stopCoord) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, stopCoord.y)
      ctx.lineTo(dims.width, stopCoord.y)
      ctx.stroke()

      // Stop Loss label
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`SL: ${activeTrade.stopLoss?.price.toFixed(2)}`, dims.width - 200, stopCoord.y + 15)

      // Stop Loss point marker
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.beginPath()
      ctx.arc(entryCoord?.x ?? dims.width / 2, stopCoord.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Target (green line)
    const targetCoord = activeTrade.target ? getPixelCoordinates(activeTrade.target.barIndex, activeTrade.target.price, dims) : null
    if (targetCoord) {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, targetCoord.y)
      ctx.lineTo(dims.width, targetCoord.y)
      ctx.stroke()

      // Target label
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`TARGET: ${activeTrade.target?.price.toFixed(2)}`, dims.width - 200, targetCoord.y - 5)

      // Target point marker
      ctx.fillStyle = 'rgba(34, 197, 94, 0.8)'
      ctx.beginPath()
      ctx.arc(entryCoord?.x ?? dims.width / 2, targetCoord.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Risk/Reward display
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = '11px monospace'
    const rrText = `R/R: ${activeTrade.riskRewardRatio.toFixed(2)}:1`
    const riskText = `Risk: $${activeTrade.riskAmount.toFixed(2)}`
    const rewardText = `Reward: $${activeTrade.rewardAmount.toFixed(2)}`

    ctx.fillText(rrText, 10, 30)
    ctx.fillText(riskText, 10, 45)
    ctx.fillText(rewardText, 10, 60)

    ctx.setLineDash([])
  }

  // Main render loop
  const render = () => {
    const canvas = canvasRef.current
    const container = containerRef.current?.parentElement
    if (!canvas || !container) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    const dims = {
      width: container.clientWidth,
      height: container.clientHeight,
    }

    canvas.width = dims.width
    canvas.height = dims.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Clear
    ctx.clearRect(0, 0, dims.width, dims.height)

    // Draw all overlays
    try {
      drawSupportResistance(ctx, dims)
      drawTrendLines(ctx, dims)
      drawSwingPoints(ctx, dims)
      drawVWAP(ctx, dims)
      drawFairValueGaps(ctx, dims)
      drawOrderBlocks(ctx, dims)
      drawLiquidity(ctx, dims)
      drawActiveTrade(ctx, dims)
    } catch (_e) {
      // Silently handle render errors to not interrupt animation loop
    }

    animationRef.current = requestAnimationFrame(render)
  }

  useEffect(() => {
    render()
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [bars.length])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  )
}
