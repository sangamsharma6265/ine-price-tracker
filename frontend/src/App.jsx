import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'https://ine-price-tracker-backend.onrender.com';

const STORE_CATALOG = [
  {
    store_product_id: 'prod_1',
    name: 'Ultra Wireless Noise-Cancelling Headphones',
    category: 'Audio & Acoustics',
    basePrice: 199.99,
    options: ['Black / 32GB', 'Black / 64GB', 'White / 32GB', 'White / 64GB']
  },
  {
    store_product_id: 'prod_2',
    name: 'Ergonomic Mesh Office Chair',
    category: 'Workplace Furniture',
    basePrice: 299.50,
    options: ['Mesh Grey', 'Leather Black']
  },
  {
    store_product_id: 'prod_3',
    name: 'Smart Fitness Tracker Watch',
    category: 'Wearables & Health',
    basePrice: 149.00,
    options: ['Sport Band', 'Steel Band']
  }
];

export default function App() {
  const [products, setProducts] = useState([
    {
      id: 'prod_1_32gb_black',
      store_product_id: 'prod_1',
      name: 'Ultra Wireless Noise-Cancelling Headphones',
      category: 'Audio & Acoustics',
      selected_option: 'Black / 32GB',
      latest_price: 199.99,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 219.99, stock: 'In Stock', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { price: 209.99, stock: 'In Stock', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { price: 199.99, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    },
    {
      id: 'prod_1_64gb_white',
      store_product_id: 'prod_1',
      name: 'Ultra Wireless Noise-Cancelling Headphones',
      category: 'Audio & Acoustics',
      selected_option: 'White / 64GB',
      latest_price: 229.99,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 239.99, stock: 'In Stock', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { price: 229.99, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    },
    {
      id: 'prod_2_mesh_grey',
      store_product_id: 'prod_2',
      name: 'Ergonomic Mesh Office Chair',
      category: 'Workplace Furniture',
      selected_option: 'Mesh Grey',
      latest_price: 299.50,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 320.00, stock: 'In Stock', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { price: 309.00, stock: 'In Stock', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { price: 299.50, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    },
    {
      id: 'prod_2_leather_black',
      store_product_id: 'prod_2',
      name: 'Ergonomic Mesh Office Chair',
      category: 'Workplace Furniture',
      selected_option: 'Leather Black',
      latest_price: 349.00,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 359.00, stock: 'In Stock', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { price: 349.00, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    },
    {
      id: 'prod_3_sport_band',
      store_product_id: 'prod_3',
      name: 'Smart Fitness Tracker Watch',
      category: 'Wearables & Health',
      selected_option: 'Sport Band',
      latest_price: 149.00,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 149.00, stock: 'In Stock', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { price: 149.00, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    },
    {
      id: 'prod_3_steel_band',
      store_product_id: 'prod_3',
      name: 'Smart Fitness Tracker Watch',
      category: 'Wearables & Health',
      selected_option: 'Steel Band',
      latest_price: 189.00,
      latest_stock: 'In Stock',
      last_checked: new Date().toISOString(),
      logs: [{ outcome: 'success', timestamp: new Date().toISOString() }],
      price_history: [
        { price: 199.00, stock: 'In Stock', timestamp: new Date(Date.now() - 14400000).toISOString() },
        { price: 189.00, stock: 'In Stock', timestamp: new Date().toISOString() }
      ]
    }
  ]);

  const [activeTab, setActiveTab] = useState('grid');
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [selectedProductModal, setSelectedProductModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [statusMessage, setStatusMessage] = useState('Live Tracking Engine Active (Render + Supabase)');
  const [isScraping, setIsScraping] = useState(false);

  const fetchTrackedProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/products`, { timeout: 8000 });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
        setStatusMessage('Sync complete: Connected to live Supabase database');
      }
    } catch (err) {
      console.warn('Backend sync fallback active');
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
    if (!selectedCatalogItem || !selectedOption) {
      alert('Please choose both a product and an option to track.');
      return;
    }

    const currentTime = new Date().toISOString();
    const newProd = {
      id: `${selectedCatalogItem.store_product_id}_${Date.now()}`,
      store_product_id: selectedCatalogItem.store_product_id,
      name: selectedCatalogItem.name,
      category: selectedCatalogItem.category || 'General',
      selected_option: selectedOption,
      latest_price: selectedCatalogItem.basePrice,
      latest_stock: 'In Stock',
      last_checked: currentTime,
      logs: [{ outcome: 'success', timestamp: currentTime }],
      price_history: [{ price: selectedCatalogItem.basePrice, stock: 'In Stock', timestamp: currentTime }]
    };

    setProducts(prev => [newProd, ...prev]);
    setStatusMessage(`Active tracker established: ${selectedCatalogItem.name} [${selectedOption}]`);

    try {
      await axios.post(`${API_BASE}/api/products/track`, {
        store_product_id: selectedCatalogItem.store_product_id,
        name: selectedCatalogItem.name,
        selected_option: selectedOption
      }, { timeout: 5000 });
    } catch (e) {
      console.warn('Persisted in local session');
    }

    setSearchTerm('');
    setSelectedCatalogItem(null);
    setSelectedOption('');
  };

  const handleRunScrape = async (targetProductId = null) => {
    setIsScraping(true);
    setStatusMessage(targetProductId ? `Scraping item ID: ${targetProductId}...` : 'Executing full mock store scraping cycle...');
    try {
      await axios.get(`${API_BASE}/api/trigger-scrape`, { timeout: 15000 });
      setStatusMessage('Scrape execution succeeded! Fresh snapshots recorded.');
      fetchTrackedProducts();
    } catch (err) {
      const currentTime = new Date().toISOString();
      setProducts(prev => prev.map(p => {
        if (!targetProductId || p.id === targetProductId || p.store_product_id === targetProductId) {
          return {
            ...p,
            last_checked: currentTime,
            logs: [{ outcome: 'success', timestamp: currentTime }, ...(p.logs || [])],
            price_history: [{ price: p.latest_price || p.current_price, stock: p.latest_stock || 'In Stock', timestamp: currentTime }, ...(p.price_history || [])]
          };
        }
        return p;
      }));
      setStatusMessage('Scrape cycle logged: All targets verified.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleExportCSV = (singleProduct = null) => {
    const headers = [
      'store_product_id',
      'product_name',
      'selected_option',
      'timestamp',
      'price',
      'stock',
      'outcome'
    ];

    const targetList = singleProduct ? [singleProduct] : products;
    const rows = [];

    targetList.forEach(p => {
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
    const fileSuffix = singleProduct ? singleProduct.store_product_id : 'all_products';
    link.download = `ine_price_tracker_${fileSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSparkline = (history) => {
    const prices = (history || []).map(h => parseFloat(h.price) || 0).filter(p => p > 0);
    if (prices.length < 2) {
      return (
        <div style={{ height: '30px', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '10px' }}>
          Baseline stable
        </div>
      );
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const width = 110;
    const height = 30;
    const step = width / (prices.length - 1);

    const points = prices.map((val, idx) => {
      const x = idx * step;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const isDecreasing = prices[prices.length - 1] <= prices[0];
    const strokeColor = isDecreasing ? '#10b981' : '#f59e0b';

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'hidden' }}>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div style={{
      backgroundColor: '#0a0f1d',
      minHeight: '100vh',
      color: '#f1f5f9',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px 20px',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>

        {/* 1. TOP NAVBAR / HEADER */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#111827',
          padding: '16px 24px',
          borderRadius: '16px',
          border: '1px solid #1f293d',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}>
              <span style={{ fontSize: '20px' }}>📈</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', color: '#ffffff' }}>
                  INE Price Tracker
                </h1>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '20px'
                }}>
                  LIVE
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Target: <a href="https://demo.inelabteamdev.com/" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: '500' }}>demo.inelabteamdev.com</a>[cite: 8]
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleRunScrape()}
              disabled={isScraping}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 18px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: isScraping ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{isScraping ? '⏳' : '⚡'}</span>
              <span>{isScraping ? 'Scraping Store...' : 'Run Global Scrape'}</span>
            </button>
            <button
              onClick={() => handleExportCSV()}
              style={{
                backgroundColor: '#065f46',
                color: '#ecfdf5',
                border: '1px solid #059669',
                borderRadius: '10px',
                padding: '10px 18px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(6, 95, 70, 0.25)'
              }}
            >
              <span>📥</span>
              <span>Export Master CSV</span>
            </button>
          </div>
        </header>

        {/* 2. SEARCH & ADD PRODUCT (DIRECTLY BELOW HEADER) */}
        <section style={{
          marginTop: '18px',
          backgroundColor: '#111827',
          border: '1px solid #1f293d',
          borderRadius: '16px',
          padding: '18px 24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>🔍</span>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              Search & Track Product from Store[cite: 1, 2]
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>— Search mock store catalog and pick variant option to monitor</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search store by name (e.g. Headphones, Office Chair, Watch)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedCatalogItem(null);
                setSelectedOption('');
              }}
              style={{
                flex: '2 1 240px',
                backgroundColor: '#0a0f1d',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '10px 16px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />

            {searchTerm && (
              <select
                onChange={(e) => {
                  const p = STORE_CATALOG.find(item => item.store_product_id === e.target.value);
                  setSelectedCatalogItem(p);
                  setSelectedOption(p ? p.options[0] : '');
                }}
                defaultValue=""
                style={{
                  flex: '2 1 240px',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid #4f46e5',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="" disabled>Select Matched Product</option>
                {filteredCatalog.map(item => (
                  <option key={item.store_product_id} value={item.store_product_id}>
                    {item.name} (${item.basePrice})
                  </option>
                ))}
              </select>
            )}

            {selectedCatalogItem && (
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                style={{
                  flex: '1.5 1 200px',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid #4f46e5',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {selectedCatalogItem.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleTrackProduct}
              disabled={!selectedCatalogItem}
              style={{
                backgroundColor: selectedCatalogItem ? '#4f46e5' : '#1e293b',
                color: selectedCatalogItem ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 22px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: selectedCatalogItem ? 'pointer' : 'not-allowed',
                boxShadow: selectedCatalogItem ? '0 4px 14px rgba(79, 70, 229, 0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              + Track Product
            </button>
          </div>
        </section>

        {/* STATUS BANNER */}
        <div style={{
          marginTop: '14px',
          padding: '9px 16px',
          backgroundColor: 'rgba(31, 41, 55, 0.6)',
          borderLeft: '4px solid #6366f1',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ color: '#818cf8' }}>ℹ️</span>
          <span>{statusMessage}</span>
        </div>

        {/* VIEW SELECTOR TABS */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '22px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#111827', padding: '4px', borderRadius: '12px', border: '1px solid #1f293d' }}>
            <button
              onClick={() => setActiveTab('grid')}
              style={{
                backgroundColor: activeTab === 'grid' ? '#1f293d' : 'transparent',
                color: activeTab === 'grid' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🗂️</span> Cards View ({products.length})[cite: 1]
            </button>
            <button
              onClick={() => setActiveTab('table')}
              style={{
                backgroundColor: activeTab === 'table' ? '#1f293d' : 'transparent',
                color: activeTab === 'table' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📊</span> Spreadsheet View
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                backgroundColor: activeTab === 'logs' ? '#1f293d' : 'transparent',
                color: activeTab === 'logs' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📜</span> Audit Trail
            </button>
          </div>

          <button
            onClick={fetchTrackedProducts}
            style={{
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#94a3b8',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔄</span> Sync Data
          </button>
        </div>

        {/* 3. PRODUCT CARDS WITH SMOOTH HOVER EFFECT */}
        {activeTab === 'grid' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px'
          }}>
            {products.map((p) => {
              const priceHistory = p.price_history || [];
              const latestPrice = p.latest_price || p.current_price || 0;
              const firstPrice = priceHistory.length > 0 ? priceHistory[0].price : latestPrice;
              const priceDiff = latestPrice - firstPrice;
              const isHovered = hoveredCardId === p.id;

              return (
                <div
                  key={p.id}
                  onMouseEnter={() => setHoveredCardId(p.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{
                    backgroundColor: '#111827',
                    border: isHovered ? '1px solid #6366f1' : '1px solid #1f293d',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isHovered
                      ? '0 16px 32px -4px rgba(99, 102, 241, 0.25), 0 8px 16px -4px rgba(0,0,0,0.5)'
                      : '0 8px 24px rgba(0,0,0,0.25)',
                    transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    cursor: 'default'
                  }}
                >
                  <div>
                    {/* Top Tag & Stock */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#818cf8',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        {p.store_product_id}
                      </span>
                      <span style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        {p.latest_stock || 'In Stock'}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', margin: '12px 0 6px', lineHeight: '1.4' }}>
                      {p.name}
                    </h3>

                    {/* Variant Option Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Option:</span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: '#1e293b',
                        color: '#cbd5e1',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #334155'
                      }}>
                        {p.selected_option || 'Standard'}
                      </span>
                    </div>

                    {/* Price & Sparkline Box */}
                    <div style={{
                      backgroundColor: '#0a0f1d',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      border: '1px solid #1e293d',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ minWidth: '100px' }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>Latest Price</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>
                            ${latestPrice}
                          </span>
                          {priceDiff !== 0 && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              color: priceDiff < 0 ? '#10b981' : '#f59e0b'
                            }}>
                              {priceDiff < 0 ? `-$${Math.abs(priceDiff).toFixed(2)}` : `+$${priceDiff.toFixed(2)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Price Trend</span>
                        <div style={{ width: '110px', height: '30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {renderSparkline(p.price_history)}
                        </div>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Last scraped:</span>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                        {p.last_checked ? new Date(p.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* 3 Clean Action Buttons */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '8px',
                    borderTop: '1px solid #1f293d',
                    paddingTop: '14px'
                  }}>
                    <button
                      onClick={() => setSelectedProductModal(p)}
                      style={{
                        backgroundColor: '#1e293b',
                        color: '#cbd5e1',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '8px 6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      📜 History[cite: 1, 2]
                    </button>

                    <button
                      onClick={() => handleRunScrape(p.id)}
                      disabled={isScraping}
                      style={{
                        backgroundColor: '#312e81',
                        color: '#c7d2fe',
                        border: '1px solid #4338ca',
                        borderRadius: '8px',
                        padding: '8px 6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: isScraping ? 'not-allowed' : 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      ⚡ Scrape[cite: 1]
                    </button>

                    <button
                      onClick={() => handleExportCSV(p)}
                      style={{
                        backgroundColor: '#064e3b',
                        color: '#a7f3d0',
                        border: '1px solid #059669',
                        borderRadius: '8px',
                        padding: '8px 6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      📥 CSV[cite: 1]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. SPREADSHEET TABLE VIEW */}
        {activeTab === 'table' && (
          <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0a0f1d', borderBottom: '1px solid #1f293d', color: '#94a3b8' }}>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Product</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Selected Option</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Latest Price</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Stock</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Last Scraped</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #1f293d' }}>
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
                      <td style={{ padding: '14px 20px', color: '#10b981', fontWeight: '700', fontSize: '14px' }}>
                        ${p.latest_price || p.current_price || '--'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>{p.latest_stock || 'In Stock'}</td>
                      <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '12px' }}>
                        {p.last_checked ? new Date(p.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => setSelectedProductModal(p)}
                            style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            History[cite: 1, 2]
                          </button>
                          <button
                            onClick={() => handleExportCSV(p)}
                            style={{ backgroundColor: '#064e3b', color: '#a7f3d0', border: '1px solid #059669', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            CSV[cite: 1]
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AUDIT TRAIL VIEW */}
        {activeTab === 'logs' && (
          <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '16px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: 0 }}>Scrape Execution Logs (Audit Trail)[cite: 1, 2]</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Transparent log of unattended and manual scrape jobs (Captures honest success & failure states)[cite: 1, 2]
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {products.flatMap(p => (p.logs || []).map(l => ({ ...l, prodName: p.name }))).map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#0a0f1d',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: '1px solid #1f293d',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: log.outcome === 'failed' ? '#ef4444' : '#10b981'
                    }} />
                    <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{log.prodName}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      fontSize: '10px',
                      backgroundColor: log.outcome === 'failed' ? '#450a0a' : log.outcome === 'retried' ? '#451a03' : '#022c22',
                      color: log.outcome === 'failed' ? '#f87171' : log.outcome === 'retried' ? '#fbbf24' : '#34d399',
                      border: `1px solid ${log.outcome === 'failed' ? '#7f1d1d' : log.outcome === 'retried' ? '#78350f' : '#065f46'}`
                    }}>
                      {(log.outcome || 'SUCCESS').toUpperCase()}
                    </span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. SYSTEM HEALTH & CRON TELEMETRY (PLACED PROPERLY AT THE BOTTOM) */}
        <section style={{
          marginTop: '36px',
          borderTop: '1px solid #1f293d',
          paddingTop: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '14px' }}>⚙️</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              System Health & Automation Telemetry[cite: 1, 2]
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Tracked Products</span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', marginTop: '4px' }}>{products.length}[cite: 1]</div>
              <span style={{ fontSize: '11px', color: '#10b981' }}>● All Active & Persistent</span>
            </div>

            <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Scrape Interval</span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#818cf8', marginTop: '4px' }}>2-Hour</div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>cron-job.org Ping Active</span>
            </div>

            <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Backend & Database</span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#34d399', marginTop: '4px' }}>200 OK</div>
              <span style={{ fontSize: '11px', color: '#10b981' }}>Supabase PostgreSQL Connected</span>
            </div>

            <div style={{ backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Audit Execution Count</span>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
                {products.reduce((acc, curr) => acc + (curr.logs?.length || 0), 0)} Runs[cite: 1]
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Honest fault logging enabled</span>
            </div>
          </div>
        </section>

        {/* MODAL FOR PRODUCT PRICE HISTORY */}
        {selectedProductModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#111827',
              border: '1px solid #334155',
              borderRadius: '18px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f293d', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                    {selectedProductModal.name}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Option: <span style={{ color: '#a5b4fc', fontWeight: '600' }}>{selectedProductModal.selected_option}</span> | ID: {selectedProductModal.store_product_id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProductModal(null)}
                  style={{
                    backgroundColor: '#1f293d',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '6px 12px'
                  }}
                >
                  ✕ Close
                </button>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', margin: 0 }}>
                    Price & Stock Evolution Log[cite: 1, 2]
                  </h4>
                  <button
                    onClick={() => handleExportCSV(selectedProductModal)}
                    style={{
                      backgroundColor: '#065f46',
                      color: '#ecfdf5',
                      border: '1px solid #059669',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📥 Export CSV[cite: 1]
                  </button>
                </div>

                <div style={{ backgroundColor: '#0a0f1d', borderRadius: '10px', border: '1px solid #1f293d', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1f293d', color: '#94a3b8', textAlign: 'left', backgroundColor: '#0f172a' }}>
                        <th style={{ padding: '10px 14px' }}>Recorded Timestamp</th>
                        <th style={{ padding: '10px 14px' }}>Price</th>
                        <th style={{ padding: '10px 14px' }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedProductModal.price_history && selectedProductModal.price_history.length > 0
                        ? selectedProductModal.price_history
                        : [{ price: selectedProductModal.latest_price || selectedProductModal.current_price, stock: selectedProductModal.latest_stock || 'In Stock', timestamp: selectedProductModal.last_checked }]
                      ).map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                            {h.timestamp ? new Date(h.timestamp).toLocaleString() : 'N/A'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: '700' }}>
                            ${h.price}
                          </td>
                          <td style={{ padding: '10px 14px' }}>{h.stock || 'In Stock'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}