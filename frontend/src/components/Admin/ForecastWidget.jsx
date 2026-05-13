import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * ForecastWidget Component
 * Fetches 4-week sales predictions from the Express backend and renders a Recharts trend.
 * 
 * @param {string} productId - The ID of the product to forecast
 */
const ForecastWidget = ({ productId }) => {
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForecastData = async () => {
      if (!productId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Base URL from environment or defaulting to backend port
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const response = await axios.get(`${baseUrl}/api/admin/forecast/${productId}`);

        if (response.data.status === 'success') {
          // Reformat the simple array into an object for Recharts
          const predictions = response.data.predictions.map((value, idx) => ({
            weekName: `Week ${idx + 1}`,
            predictedSales: value,
          }));
          setForecastData(predictions);
        } else {
          setError(response.data.message || 'Error fetching forecast');
        }
      } catch (err) {
        console.error('Forecast fetch failed:', err);
        setError('Forecasting service unavailable. Ensure python dependencies (pandas, scikit-learn) are installed.');
      } finally {
        setLoading(false);
      }
    };

    fetchForecastData();
  }, [productId]);

  if (loading) {
    return (
      <div className="p-8 bg-white border border-gray-200 rounded-lg shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <h4 className="font-bold">Forecast Error</h4>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-100 rounded-xl shadow-lg">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800">4-Week Sales Forecast</h3>
        <p className="text-sm text-gray-500">ML Predictions (Random Forest)</p>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <AreaChart
            data={forecastData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="weekName" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#9ca3af', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#9ca3af', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
            />
            <Area
              type="monotone"
              dataKey="predictedSales"
              stroke="#4f46e5"
              fillOpacity={1}
              fill="url(#colorForecast)"
              strokeWidth={3}
              name="Predicted Quantity"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6 text-center">
        {forecastData.map((d, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
            <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">{d.weekName}</span>
            <span className="block text-2xl font-black text-indigo-700">{d.predictedSales}</span>
            <span className="block text-[9px] text-gray-400">units</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ForecastWidget;
