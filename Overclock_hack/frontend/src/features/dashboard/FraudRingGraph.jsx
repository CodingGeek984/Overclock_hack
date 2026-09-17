import { useMemo, useState, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import Card from '../../components/ui/Card'

export default function FraudRingGraph({ transactions = [] }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 300 })
  const [containerRef, setContainerRef] = useState(null)

  useEffect(() => {
    if (!containerRef) return
    const observer = new ResizeObserver((entries) => {
      setDimensions({
        width: entries[0].contentRect.width,
        height: 300
      })
    })
    observer.observe(containerRef)
    return () => observer.disconnect()
  }, [containerRef])

  const graphData = useMemo(() => {
    const nodes = []
    const links = []
    const nodeMap = new Set()

    // Take recent 30 transactions to build a graph
    transactions.slice(0, 30).forEach(tx => {
      const userNodeId = `User_${tx.merchant}` // merchant is used as user_id in our mock
      const ipNodeId = `IP_${tx.ip}`
      
      // Add User Node
      if (!nodeMap.has(userNodeId)) {
        nodes.push({ id: userNodeId, group: 'User', val: 5, color: tx.status === 'BLOCK' ? '#f43f5e' : '#3b82f6' })
        nodeMap.add(userNodeId)
      }
      
      // Add IP Node
      if (!nodeMap.has(ipNodeId)) {
        nodes.push({ id: ipNodeId, group: 'IP', val: 3, color: '#a8a29e' }) // stone-400
        nodeMap.add(ipNodeId)
      }

      // Link User to IP
      links.push({
        source: userNodeId,
        target: ipNodeId,
        color: tx.status === 'BLOCK' ? 'rgba(244, 63, 94, 0.5)' : 'rgba(168, 162, 158, 0.3)'
      })
    })

    return { nodes, links }
  }, [transactions])

  return (
    <Card title="Fraud Ring Network" subtitle="Identifies shared IPs and cross-linked accounts">
      <div 
        ref={setContainerRef} 
        className="w-full h-[300px] bg-zinc-950/50 rounded-md overflow-hidden relative border border-zinc-800/50"
      >
        {dimensions.width > 0 && (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="id"
            nodeColor="color"
            nodeRelSize={4}
            linkColor="color"
            backgroundColor="transparent"
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.2}
          />
        )}
        
        {/* Legend */}
        <div className="absolute top-2 left-2 bg-zinc-900/80 p-2 rounded border border-zinc-800 flex flex-col gap-1 text-[10px] font-mono text-zinc-400 z-10 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> User (Safe)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> User (Flagged)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-400"></span> IP Address
          </div>
        </div>
      </div>
    </Card>
  )
}
