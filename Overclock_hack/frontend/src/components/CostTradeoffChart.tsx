import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { api, TradeoffDataPoint } from '../services/backendApi';

const CostTradeoffChart: React.FC = () => {
  const [data, setData] = useState<TradeoffDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState<number>(0.5);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getTradeoffData();
        setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="h-96 w-full animate-pulse bg-gray-800 rounded-2xl border border-gray-700/50"></div>;
  }

  // Calculate current costs based on selected threshold
  const currentPoint = data.reduce((prev, curr) => 
    Math.abs(curr.threshold - threshold) < Math.abs(prev.threshold - threshold) ? curr : prev
  , data[0]);

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Cost Optimization Trade-off</h2>
          <p className="text-gray-400 text-sm">Analyze how threshold impacts fraud loss vs customer inconvenience</p>
        </div>
        
        <div className="mt-4 md:mt-0 bg-gray-800/80 p-4 rounded-xl border border-gray-700 w-full md:w-64">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Selected Threshold</span>
            <span className="text-white font-bold">{threshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {currentPoint && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
            <p className="text-rose-400 text-xs font-semibold mb-1 uppercase tracking-wider">Fraud Loss</p>
            <p className="text-2xl font-bold text-white">${currentPoint.fraud_loss.toLocaleString()}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
            <p className="text-amber-400 text-xs font-semibold mb-1 uppercase tracking-wider">Friction Penalty</p>
            <p className="text-2xl font-bold text-white">${currentPoint.customer_inconvenience.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="threshold" 
              stroke="#9CA3AF" 
              tick={{fill: '#9CA3AF'}} 
              label={{ value: 'Decision Threshold', position: 'bottom', fill: '#9CA3AF' }} 
            />
            <YAxis 
              yAxisId="left" 
              stroke="#9CA3AF" 
              tick={{fill: '#9CA3AF'}}
              tickFormatter={(value) => `$${value/1000}k`}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#9CA3AF" 
              tick={{fill: '#9CA3AF'}}
              tickFormatter={(value) => `${(value*100).toFixed(0)}%`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
              itemStyle={{ fontWeight: 'bold' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {/* Cost Lines */}
            <Line yAxisId="left" type="monotone" dataKey="fraud_loss" name="Fraud Loss ($)" stroke="#F43F5E" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
            <Line yAxisId="left" type="monotone" dataKey="customer_inconvenience" name="Friction Penalty ($)" stroke="#F59E0B" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
            
            {/* Metric Lines */}
            <Line yAxisId="right" type="monotone" dataKey="precision" name="Precision" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="recall" name="Recall" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            
            {/* Threshold Reference */}
            <ReferenceLine yAxisId="left" x={threshold} stroke="#FFFFFF" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'top', value: 'Threshold', fill: 'white' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CostTradeoffChart;
