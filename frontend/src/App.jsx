import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, Plus, RefreshCw, Download, ExternalLink, ShieldAlert, CheckCircle } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const MOCK_STORE_URL = 'https://demo.inelabteamdev.com/';

export default function App() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mockStoreItems, setMockStoreItems] = useState([
    { id: 'prod_1', name: 'Ultra Wireless Headphones', price: 199.99, stock: 'In Stock', option: 'Black / 32GB' },
    { id: 'prod_2', name: 'Ergonomic Office Chair', price: 299.50, stock: 'In Stock', option: 'Mesh Grey' },
    { id: 'prod_3', name: 'Smart Fitness Watch', price: 149.00, stock: 'Low Stock', option: 'Silver Steel' },
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

  const handleTrackProduct = async (item) => {
    try {
      await axios.post(`${BACKEND_URL}/api/products/track`, {
        store_product_id: item.id,
        name: item.name,
        selected_option: item.option
      });
      alert("Product added for tracking successfully!");
      fetchTrackedProducts();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to track product");
    }
  };

  const triggerManualScrape = async () => {
    setLoading(true);
    try {
      await axios.get(`${BACKEND_URL}/api/trigger-scrape`);
      alert("Scrape cycle completed successfully!");
      fetchTrackedProducts();
    } catch (err) {
      alert("Scrape failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>INE Product Price Tracker</h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Automated web scraping & price monitoring dashboard</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={triggerManualScrape} 
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#2563eb', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
              {loading ? "Scraping..." : "Run Scrape Now"}
            </button>
            <a 
              href={MOCK_STORE_URL} 
              target="_blank" 
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#4b5563', color: 'white', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px' }}
            >
              <ExternalLink size={16} /> Open Mock Store
            </a>
          </div>
        </header>

        {/* Mock Store Section for Selection */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Available Products in Store to Track</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {mockStoreItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontWeight: '600', color: '#111827' }}>{item.name}</h4>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Option: {item.option}</p>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>${item.price}</p>
                </div>
                <button 
                  onClick={() => handleTrackProduct(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  <Plus size={14} /> Track
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tracked Products Dashboard */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>Your Tracked Products Dashboard</h3>
          
          {products.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No products tracked yet. Click 'Track' on any product above!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {products.map((prod) => (
                <div key={prod.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937' }}>{prod.name}</h4>
                      <p style={{ fontSize: '12px', color: '#6b7280' }}>Store ID: {prod.store_product_id} | Option: {prod.selected_option}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>
                        {prod.latest_price !== null ? `$${prod.latest_price}` : 'Pending Scrape'}
                      </span>
                      <p style={{ fontSize: '12px', color: prod.latest_stock === 'In Stock' ? '#059669' : '#dc2626' }}>
                        {prod.latest_stock}
                      </p>
                    </div>
                  </div>

                  {/* Scrape Logs Status */}
                  <div style={{ fontSize: '12px', color: '#4b5563', backgroundColor: '#f9fafb', padding: '8px', borderRadius: '6px' }}>
                    <strong>Recent Scrape Status: </strong>
                    {prod.logs && prod.logs.length > 0 ? (
                      <span style={{ color: prod.logs[0].outcome === 'success' ? '#059669' : '#dc2626' }}>
                        {prod.logs[0].outcome.toUpperCase()} at {new Date(prod.logs[0].timestamp).toLocaleString()}
                      </span>
                    ) : (
                      <span>No scrapes performed yet. Click 'Run Scrape Now'.</span>
                    )}
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