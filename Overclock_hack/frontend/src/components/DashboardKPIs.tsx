import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api, KPIData } from '../services/backendApi';

const DashboardKPIs: React.FC = () => {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getKPIs();
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
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-2xl p-6 h-32 border border-gray-700/50"></div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Transactions */}
      <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl flex items-center transition-transform hover:scale-105 duration-300 group">
        <div className="p-4 bg-blue-500/10 rounded-xl mr-6 group-hover:bg-blue-500/20 transition-colors">
          <Activity className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Total Transactions</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            {data.total_transactions.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Fraud Loss Saved */}
      <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl flex items-center transition-transform hover:scale-105 duration-300 group">
        <div className="p-4 bg-emerald-500/10 rounded-xl mr-6 group-hover:bg-emerald-500/20 transition-colors">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Fraud Loss Saved</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            ${data.fraud_loss_saved.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* False Positive Rate */}
      <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl flex items-center transition-transform hover:scale-105 duration-300 group">
        <div className="p-4 bg-rose-500/10 rounded-xl mr-6 group-hover:bg-rose-500/20 transition-colors">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">False Positive Rate (FPR)</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            {data.false_positive_rate.toFixed(1)}%
          </h3>
        </div>
      </div>
    </div>
  );
};

export default DashboardKPIs;
