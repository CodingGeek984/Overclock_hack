import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, AlertOctagon, CheckCircle2, Search } from 'lucide-react';
import TransactionDetailsDrawer from './TransactionDetailsDrawer';

export interface TransactionFeature {
  amount_z_score: number;
  travel_speed: number;
  velocity_1h: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  timestamp: string;
  location: string;
  risk_score: number;
  features: TransactionFeature;
}

const LiveTransactionFeed: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
  // Use a ref to hold the current paused state so the websocket handler can access it
  const isPausedRef = useRef(isPaused);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // Attempt to connect to the WebSocket endpoint
    let ws: WebSocket | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/api/v1/ws/transactions');
        
        ws.onmessage = (event) => {
          if (isPausedRef.current) return;
          const tx: Transaction = JSON.parse(event.data);
          setTransactions(prev => [tx, ...prev].slice(0, 50));
        };
        
        ws.onerror = () => {
          console.warn("WebSocket connection failed, falling back to local simulation");
          startFallbackSimulation();
        };
      } catch (e) {
        startFallbackSimulation();
      }
    };

    const startFallbackSimulation = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        if (isPausedRef.current) return;
        const isAnomaly = Math.random() < 0.2;
        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 10),
          user_id: `U${Math.floor(Math.random() * 9000) + 1000}`,
          amount: parseFloat((Math.random() * 5000 + 10).toFixed(2)),
          timestamp: new Date().toISOString(),
          location: ["New York", "London", "Tokyo", "Berlin"][Math.floor(Math.random() * 4)],
          risk_score: isAnomaly ? parseFloat((Math.random() * 30 + 70).toFixed(1)) : parseFloat((Math.random() * 30).toFixed(1)),
          features: {
            amount_z_score: isAnomaly ? parseFloat((Math.random() * 5 + 3).toFixed(2)) : parseFloat((Math.random() * 2).toFixed(2)),
            travel_speed: isAnomaly ? parseFloat((Math.random() * 2000 + 900).toFixed(2)) : parseFloat((Math.random() * 150).toFixed(2)),
            velocity_1h: isAnomaly ? Math.floor(Math.random() * 30 + 15) : Math.floor(Math.random() * 5 + 1)
          }
        };
        setTransactions(prev => [newTx, ...prev].slice(0, 50));
      }, 3000);
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  const getStatusBadge = (riskScore: number) => {
    if (riskScore >= 80) return <span className="flex items-center text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md text-xs border border-rose-400/20"><AlertOctagon className="w-3 h-3 mr-1"/> Blocked</span>;
    if (riskScore >= 50) return <span className="flex items-center text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md text-xs border border-amber-400/20"><Search className="w-3 h-3 mr-1"/> Review</span>;
    return <span className="flex items-center text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md text-xs border border-emerald-400/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Allowed</span>;
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-xl overflow-hidden mt-8 flex">
      <div className="flex-1 flex flex-col h-[500px]">
        <div className="p-4 border-b border-gray-700/50 flex justify-between items-center bg-gray-800/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${isPaused ? 'bg-gray-500' : 'bg-emerald-500 animate-pulse'}`}></span>
              Live Transaction Stream
            </h2>
            <p className="text-gray-400 text-xs">Real-time inference feed</p>
          </div>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Time</th>
                <th className="px-4 py-3">Tx ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Risk Score</th>
                <th className="px-4 py-3 rounded-r-lg">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Waiting for incoming transactions...
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr 
                    key={tx.id} 
                    onClick={() => setSelectedTx(tx)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${selectedTx?.id === tx.id ? 'bg-blue-500/10' : 'hover:bg-gray-800/30'}`}
                  >
                    <td className="px-4 py-3 text-gray-400">{new Date(tx.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{tx.id}</td>
                    <td className="px-4 py-3 text-gray-300">{tx.user_id}</td>
                    <td className="px-4 py-3 font-medium text-white">${tx.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${tx.risk_score >= 80 ? 'text-rose-400' : tx.risk_score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {tx.risk_score}%
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(tx.risk_score)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Drawer */}
      <TransactionDetailsDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
};

export default LiveTransactionFeed;
