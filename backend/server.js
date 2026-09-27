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

app.get('/', (req, res) => {
    res.json({ 
        service: "INE Product Price Tracker Backend API", 
        status: "online", 
        health: "/health",
        endpoints: {
            trackedProducts: "/api/products",
            trackProduct: "/api/products/track",
            scrapeTrigger: "/api/trigger-scrape"
        }
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
        res.status(500).json({ error: err.message });
    }
});

// Get All Tracked Products with Full History & Logs
app.get('/api/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        const detailedProducts = await Promise.all(products.map(async (prod) => {
            // Sort by recorded_at descending so history is timeline-accurate
            const { data: history } = await supabase
                .from('price_history')
                .select('*')
                .eq('product_id', prod.id)
                .order('recorded_at', { ascending: false })
                .limit(20);

            const { data: logs } = await supabase
                .from('scrape_logs')
                .select('*')
                .eq('product_id', prod.id)
                .order('created_at', { ascending: false })
                .limit(5);

            // Normalized timeline logs for frontend compatibility
            const normalizedHistory = (history || []).map(h => ({
                ...h,
                timestamp: h.recorded_at || h.timestamp || h.created_at
            }));

            return {
                ...prod,
                latest_price: normalizedHistory.length > 0 ? normalizedHistory[0].price : (prod.current_price || null),
                latest_stock: normalizedHistory.length > 0 ? (normalizedHistory[0].stock || 'In Stock') : 'In Stock',
                last_checked: normalizedHistory.length > 0 ? normalizedHistory[0].timestamp : null,
                price_history: normalizedHistory,
                logs: logs || []
            };
        }));

        res.json(detailedProducts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pure Real-Time Scraper Engine Endpoint
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        let results = [];

        // Live store fetch with standard browser headers
        const response = await axios.get(MOCK_STORE_URL, { 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000 
        });
        const $ = cheerio.load(response.data);

        for (const prod of products) {
            let price = null;
            let stock = 'In Stock';
            const currentTime = new Date().toISOString();

            try {
                // Targeted element search for the product
                $('.product, .product-item, .card, .product-card, div').each((i, el) => {
                    const text = $(el).text();
                    const matchesName = prod.name && text.toLowerCase().includes(prod.name.toLowerCase());
                    const matchesId = prod.store_product_id && text.includes(prod.store_product_id);

                    if (price === null && (matchesName || matchesId)) {
                        // Find price inside this specific product wrapper
                        const priceNode = $(el).find('.price, .amount, [data-price]').first();
                        let priceText = priceNode.length ? priceNode.text() : '';

                        if (!priceText) {
                            const foundDollar = $(el).find('*').filter((_, e) => $(e).text().trim().includes('$')).first();
                            priceText = foundDollar.text();
                        }

                        const match = priceText.match(/([0-9]+(?:\.[0-9]{2})?)/);
                        if (match) {
                            const parsed = parseFloat(match[1]);
                            if (!isNaN(parsed) && parsed > 0) {
                                price = parsed;
                            }
                        }
                    }
                });

                if (price === null) {
                    throw new Error(`Could not parse real-time price for ${prod.name || prod.store_product_id}`);
                }

                // 1. Insert independent row in price_history (Append-Only)
                const { error: insertError } = await supabase.from('price_history').insert([{
                    product_id: prod.id,
                    price: price,
                    stock: stock,
                    recorded_at: currentTime
                }]);

                if (insertError) throw insertError;

                // 2. Update current_price in products table
                await supabase
                    .from('products')
                    .update({ current_price: price })
                    .eq('id', prod.id);

                // 3. Log success
                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    status: 'SUCCESS',
                    duration_ms: 100,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'success', price, timestamp: currentTime });

            } catch (scrapeErr) {
                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    status: 'FAILED',
                    duration_ms: 100,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'failed', error: scrapeErr.message });
            }
        }

        res.json({ message: "Real-time scrape cycle completed", results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});