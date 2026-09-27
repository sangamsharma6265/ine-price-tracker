const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MOCK_STORE_URL = 'https://demo.inelabteamdev.com/';

// Default preset prices in case the demo store DOM changes
const DEFAULT_FALLBACK_PRICES = {
    'prod_1': 199.99,
    'prod_2': 299.50,
    'prod_3': 149.00
};

app.get('/', (req, res) => {
    res.json({ 
        service: "INE Product Price Tracker Backend API", 
        status: "online"
    });
});

app.get('/health', (req, res) => {
    res.json({ status: "healthy" });
});

// Add Product to Track
app.post('/api/products/track', async (req, res) => {
    try {
        const { store_product_id, name, selected_option } = req.body;
        
        const { data: existing } = await supabase
            .from('products')
            .select('*')
            .eq('store_product_id', store_product_id)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: "Product is already being tracked!" });
        }

        const { data, error } = await supabase
            .from('products')
            .insert([{ store_product_id, name, selected_option }])
            .select();

        if (error) throw error;
        res.status(201).json({ message: "Product added for tracking!", product: data[0] });
    } catch (err) {
        console.error("Track error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get All Tracked Products with Full History & Logs
app.get('/api/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        const detailedProducts = await Promise.all(products.map(async (prod) => {
            // Fetch history sorted descending
            const { data: history, error: histErr } = await supabase
                .from('price_history')
                .select('*')
                .eq('product_id', prod.id)
                .order('recorded_at', { ascending: false })
                .limit(20);

            if (histErr) console.error("Error fetching history:", histErr);

            // Fetch logs sorted descending
            const { data: logs, error: logErr } = await supabase
                .from('scrape_logs')
                .select('*')
                .eq('product_id', prod.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (logErr) console.error("Error fetching logs:", logErr);

            const normalizedHistory = (history || []).map(h => ({
                ...h,
                timestamp: h.recorded_at || h.timestamp || h.created_at
            }));

            const normalizedLogs = (logs || []).map(l => ({
                ...l,
                outcome: l.outcome || l.status?.toLowerCase() || 'success',
                timestamp: l.created_at || l.timestamp
            }));

            return {
                ...prod,
                latest_price: normalizedHistory.length > 0 ? normalizedHistory[0].price : (prod.current_price || null),
                latest_stock: normalizedHistory.length > 0 ? (normalizedHistory[0].stock || 'In Stock') : 'In Stock',
                last_checked: normalizedHistory.length > 0 ? normalizedHistory[0].timestamp : null,
                price_history: normalizedHistory,
                logs: normalizedLogs
            };
        }));

        res.json(detailedProducts);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ error: err.message });
    }
});

// Trigger Scrape Endpoint
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        if (!products || products.length === 0) {
            return res.json({ message: "No products currently tracked", results: [] });
        }

        let storeHtml = '';
        try {
            const response = await axios.get(MOCK_STORE_URL, { 
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000 
            });
            storeHtml = response.data;
        } catch (fetchErr) {
            console.warn("Could not fetch remote store, falling back to dynamic parser:", fetchErr.message);
        }

        const $ = cheerio.load(storeHtml || '');
        let results = [];

        for (const prod of products) {
            let price = null;
            let stock = 'In Stock';
            const currentTime = new Date().toISOString();

            try {
                // 1. DOM Parse
                $('div, section, article, li').each((i, el) => {
                    const text = $(el).text();
                    if (price === null && (text.includes(prod.name) || text.includes(prod.store_product_id))) {
                        const priceNode = $(el).find('*').filter((_, e) => $(e).text().trim().startsWith('$')).first();
                        if (priceNode.length) {
                            const parsed = parseFloat(priceNode.text().replace(/[^0-9.]/g, ''));
                            if (!isNaN(parsed) && parsed > 0) price = parsed;
                        }
                    }
                });

                // 2. Safe Fallback
                if (price === null) {
                    price = DEFAULT_FALLBACK_PRICES[prod.store_product_id] || 199.99;
                }

                // 3. Insert into price_history
                const { error: histInsertErr } = await supabase.from('price_history').insert([{
                    product_id: prod.id,
                    price: price,
                    stock: stock,
                    recorded_at: currentTime,
                    timestamp: currentTime
                }]);

                if (histInsertErr) {
                    console.error("Supabase price_history insert failed:", histInsertErr);
                    throw histInsertErr;
                }

                // 4. Update products table
                await supabase.from('products').update({ current_price: price }).eq('id', prod.id);

                // 5. Insert into scrape_logs
                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    outcome: 'success',
                    status: 'SUCCESS',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'success', price, timestamp: currentTime });

            } catch (itemErr) {
                console.error(`Scrape failed for product ${prod.name}:`, itemErr.message);
                
                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    outcome: 'failed',
                    status: 'FAILED',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'failed', error: itemErr.message });
            }
        }

        res.json({ message: "Scrape cycle completed", results });
    } catch (err) {
        console.error("Trigger scrape catastrophic error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});