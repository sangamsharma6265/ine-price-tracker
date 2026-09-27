import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Backend Render URL
const API_BASE = 'https://ine-price-tracker-backend.onrender.com';

// Mock store product catalog for search and option picking
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

  // 1. Fetch tracked products from Supabase via backend
  const fetchTrackedProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/products`);
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackedProducts();
  }, []);

  // Filter catalog based on search
  const filteredCatalog = STORE_CATALOG.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Add product to track
  const handleTrackProduct = async () => {
    if (!selectedProduct || !selectedOption) {
      setMessage('Please select a product and an option to track.');
      return;
    }

    try {
      setMessage('Adding product...');
      const res = await axios.post(`${API_BASE}/api/products/track`, {
        store_product_id: selectedProduct.store_product_id,
        name: selectedProduct.name,
        selected_option: selectedOption
      });

      setMessage('Product added successfully!');
      setSelectedProduct(null);
      setSelectedOption('');
      setSearchTerm('');
      fetchTrackedProducts();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to add product.');
    }
  };

  // 3. Manual Scrape Trigger
  const handleScrapeNow = async () => {
    try {
      setMessage('Scraping store in background...');
      await axios.get(`${API_BASE}/api/trigger-scrape`);
      setMessage('Scrape completed!');
      fetchTrackedProducts();
    } catch (err) {
      setMessage('Scrape error: ' + err.message);
    }
  };

  // 4. Export exact 7-column CSV (Honest failure handling)
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
    link.setAttribute('download', `ine_price_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '0 auto', color: '#1a1a1a' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>INE Price Tracker</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Store target: <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer">demo.inelabteamdev.com</a>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleScrapeNow}
            style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
          >
            Run Scrape Now
          </button>
          <button
            onClick={handleExportCSV}
            style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
          >
            Export CSV
          </button>
        </div>
      </header>

      {message && (
        <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f3f4f6', borderRadius: '6px', fontSize: '14px', borderLeft: '4px solid #2563eb' }}>
          {message}
        </div>
      )}

      {/* SEARCH AND ADD PRODUCT SECTION */}
      <section style={{ marginTop: '24px', padding: '20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 12px', fontWeight: '600' }}>🔍 Search & Track Product from Store</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search mock store (e.g. Headphones, Chair, Watch)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedProduct(null);
              setSelectedOption('');
            }}
            style={{ flex: 1, minWidth: '240px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />

          {searchTerm && (
            <select
              onChange={(e) => {
                const prod = STORE_CATALOG.find(p => p.store_product_id === e.target.value);
                setSelectedProduct(prod);
                setSelectedOption(prod ? prod.options[0] : '');
              }}
              defaultValue=""
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            >
              <option value="" disabled>Select Matched Product</option>
              {filteredCatalog.map(p => (
                <option key={p.store_product_id} value={p.store_product_id}>{p.name}</option>
              ))}
            </select>
          )}

          {selectedProduct && (
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
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
              padding: '8px 18px',
              background: selectedProduct ? '#111827' : '#9ca3af',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedProduct ? 'pointer' : 'not-allowed',
              fontWeight: '500'
            }}
          >
            Track Product
          </button>
        </div>
      </section>

      {/* TRACKED PRODUCTS TABLE */}
      <section style={{ marginTop: '28px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 14px', fontWeight: '600' }}>
          Tracked Products & Live Price ({products.length})
        </h2>

        {loading ? (
          <p>Loading tracked products...</p>
        ) : products.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No products tracked yet. Use the search bar above to add products.</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th style={{ padding: '12px' }}>Product</th>
                  <th style={{ padding: '12px' }}>Selected Option</th>
                  <th style={{ padding: '12px' }}>Latest Price</th>
                  <th style={{ padding: '12px' }}>Stock</th>
                  <th style={{ padding: '12px' }}>Last Scraped</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      {p.name}
                      <span style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>ID: {p.store_product_id}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {p.selected_option || 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#059669' }}>
                      ${p.latest_price || p.current_price || '--'}
                    </td>
                    <td style={{ padding: '12px' }}>{p.latest_stock || 'In Stock'}</td>
                    <td style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
                      {p.last_checked ? new Date(p.last_checked).toLocaleString() : 'Pending Scrape'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SCRAPE LOGS / AUDIT TRAIL */}
      <section style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 12px', fontWeight: '600' }}>Scrape Execution Logs (Audit Trail)</h2>
        <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', background: '#fafafa', fontSize: '13px' }}>
          {products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No audit logs recorded yet.</p>
          ) : (
            products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).map((log, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <span><strong>{log.prodName}</strong></span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: log.outcome === 'failed' ? '#fee2e2' : log.outcome === 'retried' ? '#fef3c7' : '#d1fae5',
                  color: log.outcome === 'failed' ? '#b91c1c' : log.outcome === 'retried' ? '#b45309' : '#047857'
                }}>
                  {log.outcome?.toUpperCase() || 'SUCCESS'}
                </span>
                <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{log.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}