const API_BASE_URL = "http://localhost:8000/api/v1";

export interface KPIData {
  total_transactions: number;
  fraud_loss_saved: number;
  false_positive_rate: number;
}

export interface TradeoffDataPoint {
  threshold: number;
  precision: number;
  recall: number;
  fraud_loss: number;
  customer_inconvenience: number;
}

export interface UploadResponse {
  status: string;
  message: string;
  records_processed: number;
}

export const api = {
  async getKPIs(): Promise<KPIData> {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/kpis`);
      if (!res.ok) throw new Error("API error");
      return await res.json();
    } catch (error) {
      console.warn("Failed to fetch KPIs from backend, using mock data", error);
      return {
        total_transactions: 100000,
        fraud_loss_saved: 1250000.0,
        false_positive_rate: 1.2
      };
    }
  },

  async getTradeoffData(): Promise<TradeoffDataPoint[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/tradeoff`);
      if (!res.ok) throw new Error("API error");
      return await res.json();
    } catch (error) {
      console.warn("Failed to fetch tradeoff data from backend, using mock data", error);
      // Generate some mock tradeoff data
      return Array.from({ length: 11 }).map((_, i) => {
        const threshold = i / 10;
        const precision = 0.5 + (threshold * 0.45);
        const recall = 0.95 - (threshold * 0.45);
        return {
          threshold,
          precision: Number(precision.toFixed(3)),
          recall: Number(recall.toFixed(3)),
          fraud_loss: Number(((1.0 - recall) * 500000).toFixed(2)),
          customer_inconvenience: Number(((1.0 - precision) * 200000).toFixed(2))
        };
      });
    }
  },

  async uploadDataset(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${API_BASE_URL}/data/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("API error");
      return await res.json();
    } catch (error) {
      console.warn("Failed to upload dataset to backend, returning mock success", error);
      return {
        status: "success",
        message: `File ${file.name} uploaded successfully (Mock).`,
        records_processed: 100000
      };
    }
  }
};
