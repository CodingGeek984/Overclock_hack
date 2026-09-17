import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/backendApi';

const DatasetUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    try {
      const res = await api.uploadDataset(file);
      setStatus('success');
      setMessage(res.message);
    } catch (error) {
      setStatus('error');
      setMessage('Failed to upload dataset.');
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-4">Dataset Ingestion</h2>
      <p className="text-gray-400 text-sm mb-6">Upload synthetic transactions (CSV/Parquet) for batch processing.</p>

      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          file ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".csv,.parquet" 
        />
        
        {file ? (
          <div className="flex flex-col items-center">
            <FileType className="w-12 h-12 text-blue-400 mb-3" />
            <p className="text-white font-medium mb-1">{file.name}</p>
            <p className="text-gray-400 text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-300 font-medium mb-1">Click or drag file to this area to upload</p>
            <p className="text-gray-500 text-xs">Support for a single or bulk upload. Strictly CSV or Parquet.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status === 'success' && (
            <div className="flex items-center text-emerald-400 text-sm bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20">
              <CheckCircle className="w-4 h-4 mr-2" />
              {message}
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center text-rose-400 text-sm bg-rose-400/10 px-3 py-1.5 rounded-lg border border-rose-400/20">
              <AlertCircle className="w-4 h-4 mr-2" />
              {message}
            </div>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || status === 'uploading'}
          className={`flex items-center px-6 py-2.5 rounded-lg font-medium transition-all ${
            !file 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
          }`}
        >
          {status === 'uploading' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Run ML Pipeline'
          )}
        </button>
      </div>
    </div>
  );
};

export default DatasetUploader;
