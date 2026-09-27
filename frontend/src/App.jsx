import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Backend Render URL
const API_BASE = 'https://ine-price-tracker-backend.onrender.com';

const STORE_CATALOG = [
  {
    store_product_id: 'prod_1',
    name: 'Ultra Wireless Noise-Cancelling Headphones',
    options: ['Black / 32GB', 'Black / 64GB', 'White / 32GB', 'White / 64GB']
  },
  {
    store_product_id: 'prod_2',
    name: 'Ergonomic Mesh Office Chair',
    options: ['Mesh Grey', 'Leather Black']
  },
  {
    store_product_id: 'prod_3',
    name: 'Smart Fitness Tracker Watch',
    options: ['Sport Band', 'Steel Band']
  }
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [message, setMessage] = useState('');

  // 1. Fetch tracked products
  const fetchTrackedProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/products`);
      setProducts(res.data || []);
      setMessage('');
    } catch (err) {
      console.error('Error fetching products:', err);
      // Fallback check
      setMessage('Connecting to backend...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackedProducts();
  }, []);

  const filteredCatalog = STORE_CATALOG.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Add product
  const handleTrackProduct = async () => {
    if (!selectedProduct || !selectedOption) {
      alert('Please select a product and an option to track.');
      return;
    }

    try {
      setMessage('Adding product to tracker...');
      await axios.post(`${API_BASE}/api/products/track`, {
        store_product_id: selectedProduct.store_product_id,
        name: selectedProduct.name,
        selected_option: selectedOption
      });

      setMessage('Product tracked successfully!');
      setSelectedProduct(null);
      setSelectedOption('');
      setSearchTerm('');
      fetchTrackedProducts();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to track product.');
    }
  };

  // 3. Manual Scrape Trigger
  const handleScrapeNow = async () => {
    try {
      setMessage('Scraping store in background...');
      await axios.get(`${API_BASE}/api/trigger-scrape`);
      setMessage('Scrape cycle completed!');
      fetchTrackedProducts();
    } catch (err) {
      setMessage('Scrape error: ' + (err.response?.data?.error || err.message));
    }
  };

  // 4. Export strict 7-column CSV
  const handleExportCSV = () => {
    const headers = [
      'store_product_id',
      'product_name',
      'selected_option',
      'timestamp',
      'price',
      'stock',
      'outcome'
    ];

    const rows = [];

    products.forEach(p => {
      const logs = p.logs || [];
      const history = p.price_history || [];

      if (logs.length === 0 && history.length === 0) {
        rows.push([
          p.store_product_id,
          `"${p.name}"`,
          `"${p.selected_option || ''}"`,
          new Date().toISOString(),
          p.current_price || '',
          'In Stock',
          'success'
        ].join(','));
      } else {
        logs.forEach(log => {
          const matchedHistory = history.find(h => h.timestamp === log.timestamp) || {};
          const isFailed = log.outcome === 'failed';

          rows.push([
            p.store_product_id,
            `"${p.name}"`,
            `"${p.selected_option || ''}"`,
            log.timestamp || new Date().toISOString(),
            isFailed ? '' : (matchedHistory.price || p.current_price || ''),
            isFailed ? '' : (matchedHistory.stock || 'In Stock'),
            log.outcome || 'success'
          ].join(','));
        });
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ine_price_tracker_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">INE Price Tracker</h1>
            <p className="text-sm text-slate-400 mt-1">
              Automated mock store monitoring: <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline">demo.inelabteamdev.com</a>[cite: 8]
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleScrapeNow}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium text-sm rounded-lg transition-colors shadow-sm"
            >
              Run Scrape Now
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-medium text-sm rounded-lg transition-colors shadow-sm"
            >
              Export CSV
            </button>
          </div>
        </header>

        {message && (
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-indigo-300">
            {message}
          </div>
        )}

        {/* Search & Track Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-base font-semibold text-slate-200 mb-3">🔍 Search & Track Product from Store</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Search store (e.g. Headphones, Chair, Watch)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedProduct(null);
                setSelectedOption('');
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />

            <select
              onChange={(e) => {
                const prod = STORE_CATALOG.find(p => p.store_product_id === e.target.value);
                setSelectedProduct(prod);
                setSelectedOption(prod ? prod.options[0] : '');
              }}
              value={selectedProduct ? selectedProduct.store_product_id : ''}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select Matched Product</option>
              {filteredCatalog.map(p => (
                <option key={p.store_product_id} value={p.store_product_id}>{p.name}</option>
              ))}
            </select>

            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              disabled={!selectedProduct}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="" disabled>Select Variant Option</option>
              {selectedProduct?.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <button
              onClick={handleTrackProduct}
              disabled={!selectedProduct || !selectedOption}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-medium text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Track Product
            </button>
          </div>
        </section>

        {/* Tracked Products Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-base font-semibold text-white">Tracked Products ({products.length})</h2>
            <button onClick={fetchTrackedProducts} className="text-xs text-indigo-400 hover:underline">Refresh</button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading tracked data...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No products tracked yet. Use the search tool above to begin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Selected Option</th>
                    <th className="py-3 px-4">Latest Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Last Scraped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">ID: {p.store_product_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded text-xs">
                          {p.selected_option || 'Default'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        ${p.latest_price || p.current_price || '--'}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{p.latest_stock || 'In Stock'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {p.last_checked ? new Date(p.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Scrape Execution Logs (Audit Trail) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-base font-semibold text-white mb-3">Scrape Execution Logs (Audit Trail)</h2>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-2">
            {products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).length === 0 ? (
              <p className="text-xs text-slate-500">No execution logs found.</p>
            ) : (
              products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).map((log, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
                  <span className="font-medium text-slate-200">{log.prodName}</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                    log.outcome === 'failed' ? 'bg-red-950 text-red-400 border border-red-800' :
                    log.outcome === 'retried' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}>
                    {log.outcome?.toUpperCase() || 'SUCCESS'}
                  </span>
                  <span className="text-slate-500 font-mono">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}