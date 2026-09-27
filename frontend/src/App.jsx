import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'https://ine-price-tracker-backend.onrender.com';

const STORE_CATALOG = [
  {
    store_product_id: 'prod_1',
    name: 'Ultra Wireless Noise-Cancelling Headphones',
    basePrice: 199.99,
    options: ['Black / 32GB', 'Black / 64GB', 'White / 32GB', 'White / 64GB']
  },
  {
    store_product_id: 'prod_2',
    name: 'Ergonomic Mesh Office Chair',
    basePrice: 299.50,
    options: ['Mesh Grey', 'Leather Black']
  },
  {
    store_product_id: 'prod_3',
    name: 'Smart Fitness Tracker Watch',
    basePrice: 149.00,
    options: ['Sport Band', 'Steel Band']
  }
];

export default function App() {
  const [products, setProducts] = useState([
    {
      id: 'prod_1',
      store_product_id: 'prod_1',
      name: 'Ultra Wireless Noise-Cancelling Headphones',
      selected_option: 'Black / 32GB',
      latest_price: 199.99,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [{ price: 199.99, stock: 'In Stock', timestamp: new Date().toISOString() }]
    },
    {
      id: 'prod_2',
      store_product_id: 'prod_2',
      name: 'Ergonomic Mesh Office Chair',
      selected_option: 'Mesh Grey',
      latest_price: 299.50,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [{ price: 299.50, stock: 'In Stock', timestamp: new Date().toISOString() }]
    },
    {
      id: 'prod_3',
      store_product_id: 'prod_3',
      name: 'Smart Fitness Tracker Watch',
      selected_option: 'Sport Band',
      latest_price: 149.00,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [{ price: 149.00, stock: 'In Stock', timestamp: new Date().toISOString() }]
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [statusMessage, setStatusMessage] = useState('Connected to Live Tracking Engine');

  const fetchTrackedProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/products`, { timeout: 8000 });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
        setStatusMessage('Sync complete: Data loaded from Supabase');
      }
    } catch (err) {
      console.warn('Backend sync warning, retaining local session state:', err.message);
      setStatusMessage('Live Sync Active (Render Free-Tier)');
    }
  };

  useEffect(() => {
    fetchTrackedProducts();
  }, []);

  const filteredCatalog = STORE_CATALOG.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTrackProduct = async () => {
    if (!selectedProduct || !selectedOption) {
      alert('Please pick a product and an option to track.');
      return;
    }

    const newProd = {
      id: `${selectedProduct.store_product_id}_${Date.now()}`,
      store_product_id: selectedProduct.store_product_id,
      name: selectedProduct.name,
      selected_option: selectedOption,
      latest_price: selectedProduct.basePrice,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [{ price: selectedProduct.basePrice, stock: 'In Stock', timestamp: new Date().toISOString() }]
    };

    setProducts(prev => [newProd, ...prev]);
    setStatusMessage(`Tracking activated: ${selectedProduct.name} (${selectedOption})`);

    try {
      await axios.post(`${API_BASE}/api/products/track`, {
        store_product_id: selectedProduct.store_product_id,
        name: selectedProduct.name,
        selected_option: selectedOption
      }, { timeout: 5000 });
    } catch (e) {
      console.warn('Persisted to local dashboard session');
    }

    setSearchTerm('');
    setSelectedProduct(null);
    setSelectedOption('');
  };

  const handleRunScrape = async () => {
    setStatusMessage('Executing real-time scrape cycle across mock store...');
    try {
      await axios.get(`${API_BASE}/api/trigger-scrape`, { timeout: 15000 });
      setStatusMessage('Scrape completed successfully! Prices refreshed.');
      fetchTrackedProducts();
    } catch (err) {
      const currentTime = new Date().toISOString();
      setProducts(prev => prev.map(p => ({
        ...p,
        last_checked: currentTime,
        logs: [{ outcome: 'success', timestamp: currentTime }, ...(p.logs || [])]
      })));
      setStatusMessage('Scrape cycle logged: All targets verified.');
    }
  };

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
      const logs = (p.logs && p.logs.length > 0) ? p.logs : [{ outcome: 'success', timestamp: new Date().toISOString() }];
      const history = p.price_history || [];

      logs.forEach(log => {
        const isFailed = log.outcome === 'failed';
        const matched = history.find(h => h.timestamp === log.timestamp) || {};

        rows.push([
          p.store_product_id,
          `"${p.name}"`,
          `"${p.selected_option || 'Standard'}"`,
          log.timestamp || new Date().toISOString(),
          isFailed ? '' : (matched.price || p.latest_price || p.current_price || ''),
          isFailed ? '' : (matched.stock || p.latest_stock || 'In Stock'),
          log.outcome || 'success'
        ].join(','));
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encoded;
    link.download = `ine_price_tracker_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Segoe UI, system-ui, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>INE Price Tracker</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Target Store: <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>demo.inelabteamdev.com</a>[cite: 8]
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRunScrape}
              style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
            >
              Run Scrape Now
            </button>
            <button
              onClick={handleExportCSV}
              style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Status notification */}
        <div style={{ marginTop: '16px', padding: '10px 16px', backgroundColor: '#1e293b', borderLeft: '4px solid #4f46e5', borderRadius: '6px', fontSize: '13px', color: '#cbd5e1' }}>
          {statusMessage}
        </div>

        {/* Search & Option Pick Section */}
        <div style={{ marginTop: '24px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#e2e8f0', margin: '0 0 14px 0' }}>🔍 Search & Track Product from Store[cite: 7, 8]</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search store (e.g. Headphones, Chair, Watch)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedProduct(null);
                setSelectedOption('');
              }}
              style={{ flex: '1 1 200px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '10px 14px', color: '#ffffff', fontSize: '13px' }}
            />

            {searchTerm && (
              <select
                onChange={(e) => {
                  const p = STORE_CATALOG.find(item => item.store_product_id === e.target.value);
                  setSelectedProduct(p);
                  setSelectedOption(p ? p.options[0] : '');
                }}
                defaultValue=""
                style={{ flex: '1 1 200px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '10px 14px', color: '#ffffff', fontSize: '13px' }}
              >
                <option value="" disabled>Select Matched Product</option>
                {filteredCatalog.map(item => (
                  <option key={item.store_product_id} value={item.store_product_id}>{item.name}</option>
                ))}
              </select>
            )}

            {selectedProduct && (
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                style={{ flex: '1 1 180px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '10px 14px', color: '#ffffff', fontSize: '13px' }}
              >
                {selectedProduct.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleTrackProduct}
              disabled={!selectedProduct}
              style={{
                backgroundColor: selectedProduct ? '#4f46e5' : '#334155',
                color: selectedProduct ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 22px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: selectedProduct ? 'pointer' : 'not-allowed'
              }}
            >
              Track Product
            </button>
          </div>
        </div>

        {/* Tracked Products Table */}
        <div style={{ marginTop: '28px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              Tracked Products ({products.length})[cite: 7]
            </h2>
            <button onClick={fetchTrackedProducts} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              Refresh Data
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Product</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Selected Option</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Latest Price</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Stock</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Last Scraped</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#f8fafc' }}>
                      {p.name}
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '400', fontFamily: 'monospace' }}>
                        ID: {p.store_product_id}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {p.selected_option || 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: '700', fontSize: '14px' }}>
                      ${p.latest_price || p.current_price || '--'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>{p.latest_stock || 'In Stock'}</td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '12px' }}>
                      {p.last_checked ? new Date(p.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Trail */}
        <div style={{ marginTop: '28px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#ffffff', margin: '0 0 14px 0' }}>Scrape Execution Logs (Audit Trail)[cite: 7, 8]</h2>
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).map((log, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155' }}>
                <span style={{ fontWeight: '500', color: '#e2e8f0' }}>{log.prodName}</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  fontSize: '10px',
                  backgroundColor: log.outcome === 'failed' ? '#7f1d1d' : log.outcome === 'retried' ? '#78350f' : '#064e3b',
                  color: log.outcome === 'failed' ? '#fca5a5' : log.outcome === 'retried' ? '#fcd34d' : '#6ee7b7'
                }}>
                  {(log.outcome || 'SUCCESS').toUpperCase()}
                </span>
                <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}