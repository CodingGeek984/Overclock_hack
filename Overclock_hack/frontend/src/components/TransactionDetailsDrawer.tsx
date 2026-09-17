import React from 'react';
import { X, Activity, Globe, Clock, ShieldAlert } from 'lucide-react';
import { Transaction } from './LiveTransactionFeed';

interface DrawerProps {
  tx: Transaction | null;
  onClose: () => void;
}

const TransactionDetailsDrawer: React.FC<DrawerProps> = ({ tx, onClose }) => {
  if (!tx) return null;

  const isAnomaly = tx.risk_score >= 80;

  return (
    <div className="w-96 border-l border-gray-700/50 bg-gray-800/80 p-6 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center">
            Tx: <span className="font-mono text-blue-400 ml-2">{tx.id}</span>
          </h3>
          <p className="text-gray-400 text-sm">{new Date(tx.timestamp).toLocaleString()}</p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white bg-gray-700/50 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-6 flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Risk Score</p>
          <p className={`text-3xl font-bold ${isAnomaly ? 'text-rose-400' : tx.risk_score >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {tx.risk_score}%
          </p>
        </div>
        {isAnomaly && <ShieldAlert className="w-10 h-10 text-rose-500/50" />}
      </div>

      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Explainable AI (SHAP)</h4>
      
      <div className="space-y-5">
        {/* Z-Score Feature */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center text-gray-300"><Activity className="w-4 h-4 mr-2 text-blue-400" /> Amount Z-Score</span>
            <span className="font-mono text-white">{tx.features.amount_z_score}x</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${tx.features.amount_z_score > 2.5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min((Math.abs(tx.features.amount_z_score) / 5) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500">Deviation from user's 30-day average.</p>
        </div>

        {/* Travel Speed Feature */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center text-gray-300"><Globe className="w-4 h-4 mr-2 text-blue-400" /> Travel Speed</span>
            <span className="font-mono text-white">{tx.features.travel_speed} km/h</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${tx.features.travel_speed > 900 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min((tx.features.travel_speed / 1500) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500">Calculated speed since last known location.</p>
        </div>

        {/* Velocity Feature */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center text-gray-300"><Clock className="w-4 h-4 mr-2 text-blue-400" /> 1h Velocity</span>
            <span className="font-mono text-white">{tx.features.velocity_1h} txs</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${tx.features.velocity_1h > 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min((tx.features.velocity_1h / 30) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500">Number of transactions in the last hour.</p>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
          isAnomaly 
            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30' 
            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
        }`}>
          {isAnomaly ? 'Confirm Fraud (Block User)' : 'Mark as Safe'}
        </button>
      </div>
    </div>
  );
};

export default TransactionDetailsDrawer;
