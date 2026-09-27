import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Product Name,Store ID,Price,Stock,Timestamp\n";
    products.forEach(p => {
      const history = p.price_history || [];
      if (history.length > 0) {
        history.forEach(item => {
          const time = item.recorded_at || item.timestamp || item.created_at || '';
          csvContent += `"${p.name}","${p.store_product_id}",${item.price || 0},"${item.stock || p.latest_stock || 'In Stock'}","${time}"\n`;
        });
      } else {
        csvContent += `"${p.name}","${p.store_product_id}",${p.latest_price || 0},"${p.latest_stock || 'In Stock'}","${p.last_checked || new Date().toISOString()}"\n`;
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

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#0b0f19', color: '#f3f4f6', padding: '20px', fontFamily: 'Segoe UI, sans-serif' },
    wrapper: { maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' },
    header: { backgroundColor: '#111827', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
    title: { fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', margin: 0 },
    subtitle: { fontSize: '14px', color: '#9ca3af', margin: '4px 0 0 0' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    primaryBtn: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    successBtn: { backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    secondaryBtn: { backgroundColor: '#374151', color: '#fff', border: '1px solid #4b5563', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', textDecoration: 'none', display: 'inline-block' },
    section: { backgroundColor: '#111827', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937' },
    sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#e5e7eb' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
    card: { backgroundColor: '#030712', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
    trackBtn: { backgroundColor: 'rgba(5, 150, 105, 0.2)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.4)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', marginTop: '12px', width: '100%' },
    logBox: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1f2937' },
    subBox: { backgroundColor: '#030712', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937', maxHeight: '160px', overflowY: 'auto' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>INE Product Price Tracker</h1>
            <p style={styles.subtitle}>Automated web scraping & price monitoring dashboard</p>
          </div>
          <div style={styles.btnGroup}>
            <button onClick={triggerScrape} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Scraping...' : 'Run Scrape Now'}
            </button>
            <button onClick={exportCSV} style={styles.successBtn}>
              Export CSV
            </button>
            <a href={MOCK_STORE_URL} target="_blank" rel="noreferrer" style={styles.secondaryBtn}>
              Open Mock Store
            </a>
          </div>
        </div>

        {/* Available Products Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Available Products in Store to Track</h2>
          <div style={styles.grid}>
            {mockStoreItems.map(item => (
              <div key={item.id} style={styles.card}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{item.name}</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0' }}>Option: {item.option}</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399', margin: '8px 0 0 0' }}>${item.price}</p>
                </div>
                <button onClick={() => handleTrack(item)} style={styles.trackBtn}>
                  + Track Product
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tracked Products Dashboard */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Tracked Products Dashboard</h2>
          
          {products.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px', fontSize: '14px' }}>
              No products tracked yet. Click 'Track Product' on any item above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {products.map(prod => {
                const logs = prod.logs || [];
                const priceHistory = prod.price_history || [];
                const latestLog = logs.length > 0 ? logs[0] : null;
                const latestStatus = latestLog ? (latestLog.status || latestLog.outcome || 'SUCCESS') : null;
                const latestLogTime = latestLog ? (latestLog.created_at || latestLog.timestamp) : null;

                return (
                  <div key={prod.id} style={{ ...styles.card, padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{prod.name}</h3>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                          Store ID: {prod.store_product_id} | Option: {prod.selected_option}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '22px', fontWeight: 'extrabold', color: '#34d399', margin: 0 }}>
                          {prod.latest_price !== null && prod.latest_price !== undefined ? `$${prod.latest_price}` : 'Pending'}
                        </p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{prod.latest_stock || 'In Stock'}</p>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', backgroundColor: '#111827', padding: '10px 14px', borderRadius: '8px', marginTop: '14px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#9ca3af', fontWeight: '600' }}>Recent Scrape Status:</span>
                      {latestStatus ? (
                        <span style={{ color: latestStatus.toUpperCase() === 'SUCCESS' ? '#34d399' : '#f87171', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {latestStatus} at {formatTimestamp(latestLogTime)}
                        </span>
                      ) : (
                        <span style={{ color: '#f59e0b', fontWeight: '600' }}>No scrapes performed yet. Click 'Run Scrape Now'.</span>
                      )}
                    </div>

                    {/* Price History & Scrape Logs Section */}
                    <div style={styles.logBox}>
                      {/* Independent Historical Price Timeline */}
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Price History Log ({priceHistory.length} records)
                        </h4>
                        <div style={styles.subBox}>
                          {priceHistory.length > 0 ? (
                            priceHistory.map((hist, idx) => {
                              const recTime = hist.recorded_at || hist.timestamp || hist.created_at;
                              return (
                                <div key={hist.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', borderBottom: '1px solid #1f2937', paddingBottom: '6px', marginBottom: '6px' }}>
                                  <span>{formatTimestamp(recTime)}</span>
                                  <span style={{ color: '#34d399', fontWeight: '600' }}>${hist.price}</span>
                                </div>
                              );
                            })
                          ) : (
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>No price history recorded yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Execution Logs */}
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Scrape Execution Logs
                        </h4>
                        <div style={styles.subBox}>
                          {logs.length > 0 ? (
                            logs.map((log, idx) => {
                              const logTime = log.created_at || log.timestamp;
                              const status = (log.status || log.outcome || 'SUCCESS').toUpperCase();
                              return (
                                <div key={log.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #1f2937', paddingBottom: '6px', marginBottom: '6px' }}>
                                  <span style={{ color: '#9ca3af' }}>{formatTimestamp(logTime)}</span>
                                  <span style={{ color: status === 'SUCCESS' ? '#34d399' : '#f87171', fontWeight: '600' }}>
                                    {status}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>No logs available.</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}