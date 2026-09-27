import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, ExternalLink, Plus } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ine-price-tracker-backend.onrender.com';
const MOCK_STORE_URL = 'https://demo.inelabteamdev.com/';

export default function App() {
  const [products, setProducts] = useState([]);
  const [mockStoreItems] = useState([
    { id: 'prod_1', name: 'Ultra Wireless Headphones', option: 'Black / 32GB', price: 199.99 },
    { id: 'prod_2', name: 'Ergonomic Office Chair', option: 'Mesh Grey', price: 299.50 },
    { id: 'prod_3', name: 'Smart Fitness Watch', option: 'Silver Steel', price: 149.00 }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrackedProducts();
  }, []);

  const fetchTrackedProducts = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const handleTrack = async (item) => {
    try {
      await axios.post(`${BACKEND_URL}/api/products/track`, {
        store_product_id: item.id,
        name: item.name,
        selected_option: item.option
      });
      alert("Product added for tracking successfully!");
      fetchTrackedProducts();
    } catch (err) {
      alert(err.response?.data?.error || "Error tracking product");
    }
  };

  const triggerScrape = async () => {
    setLoading(true);
    try {
      await axios.get(`${BACKEND_URL}/api/trigger-scrape`);
      alert("Scrape cycle completed successfully!");
      fetchTrackedProducts();
    } catch (err) {
      alert("Error triggering scrape");
    }
    setLoading(false);
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Product Name,Store ID,Price,Stock,Timestamp\n";
    products.forEach(p => {
      if (p.logs && p.logs.length > 0) {
        p.logs.forEach(l => {
          csvContent += `"${p.name}","${p.store_product_id}",${p.latest_price || 0},"${p.latest_stock}","${l.timestamp}"\n`;
        });
      }
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ine_price_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl gap-4">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              INE Product Price Tracker
            </h1>
            <p className="text-sm text-gray-400 mt-1">Automated web scraping & price monitoring dashboard</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={triggerScrape}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition shadow-lg disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scraping...' : 'Run Scrape Now'}
            </button>
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-medium transition shadow-lg text-sm"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <a 
              href={MOCK_STORE_URL} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2.5 rounded-xl font-medium transition border border-gray-700 text-sm"
            >
              <ExternalLink className="w-4 h-4" /> Open Mock Store
            </a>
          </div>
        </div>

        {/* Available Products Section */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl">
          <h2 className="text-lg font-bold mb-4 text-gray-200">Available Products in Store to Track</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockStoreItems.map(item => (
              <div key={item.id} className="bg-gray-950 p-5 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-700 transition">
                <div>
                  <h3 className="font-semibold text-gray-100">{item.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">Option: {item.option}</p>
                  <p className="text-emerald-400 font-bold text-lg mt-2">${item.price}</p>
                </div>
                <button
                  onClick={() => handleTrack(item)}
                  className="mt-5 flex items-center justify-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 py-2 rounded-lg transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Track Product
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tracked Products Dashboard */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-gray-200">Your Tracked Products Dashboard</h2>
          
          {products.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No products tracked yet. Click 'Track Product' on any item above!</p>
          ) : (
            <div className="space-y-6">
              {products.map(prod => (
                <div key={prod.id} className="bg-gray-950 p-6 rounded-2xl border border-gray-800 shadow-inner space-y-5">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-100">{prod.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Store ID: <span className="text-gray-300">{prod.store_product_id}</span> | Option: <span className="text-gray-300">{prod.selected_option}</span></p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-2xl font-extrabold text-emerald-400">
                        {prod.latest_price !== null ? `$${prod.latest_price}` : 'Pending'}
                      </p>
                      <p className="text-xs font-medium text-gray-400">{prod.latest_stock || 'Unknown'}</p>
                    </div>
                  </div>

                  <div className="text-xs bg-gray-900 p-3 rounded-xl border border-gray-800 text-gray-300 flex items-center justify-between">
                    <span className="font-semibold text-gray-400">Recent Scrape Status:</span>
                    {prod.logs && prod.logs.length > 0 ? (
                      <span className={prod.logs[0].outcome === 'success' ? 'text-emerald-400 font-bold uppercase tracking-wide' : 'text-rose-400 font-bold uppercase tracking-wide'}>
                        {prod.logs[0].outcome} at {new Date(prod.logs[0].timestamp).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-yellow-500 font-medium">No scrapes performed yet. Click 'Run Scrape Now'.</span>
                    )}
                  </div>

                  {/* Price History & Scrape Logs Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-gray-800">
                    <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Price History Log</h4>
                      <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                        {prod.logs && prod.logs.length > 0 ? (
                          prod.logs.map((log, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs text-gray-300 border-b border-gray-800/80 pb-2">
                              <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                              <span className="text-emerald-400 font-semibold">{prod.latest_price ? `$${prod.latest_price}` : 'N/A'}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-500">No history recorded yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Recent Scrape Logs (Outcome & Timestamp)</h4>
                      <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                        {prod.logs && prod.logs.length > 0 ? (
                          prod.logs.map((log, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-800/80 pb-2">
                              <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <span className={log.outcome === 'success' ? 'text-emerald-400 font-semibold uppercase' : 'text-rose-400 font-semibold uppercase'}>
                                {log.outcome} {log.error_message ? `(${log.error_message})` : ''}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-500">No logs available.</p>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}