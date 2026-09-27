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
    res.json({ service: "INE Product Price Tracker API", status: "online" });
});

app.get('/health', (req, res) => res.json({ status: "healthy" }));

// 1. Add Product to Track
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

// 2. Get All Tracked Products with Guaranteed price_history Array
app.get('/api/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        const detailedProducts = await Promise.all(products.map(async (prod) => {
            const numId = prod.store_product_id ? prod.store_product_id.replace(/\D/g, '') : null;
            const validIds = [
                String(prod.id),
                prod.store_product_id ? String(prod.store_product_id) : null,
                numId ? String(numId) : null
            ].filter(Boolean);

            // Fetch price history
            const { data: history, error: histErr } = await supabase
                .from('price_history')
                .select('*')
                .in('product_id', validIds)
                .order('recorded_at', { ascending: false });

            if (histErr) {
                console.error(`History query failed for product ${prod.id}:`, histErr.message);
            }

            // Fetch scrape logs
            const { data: logs, error: logErr } = await supabase
                .from('scrape_logs')
                .select('*')
                .in('product_id', validIds)
                .order('created_at', { ascending: false })
                .limit(10);

            if (logErr) {
                console.error(`Logs query failed for product ${prod.id}:`, logErr.message);
            }

            // Format history array explicitly for frontend chart & logs table
            const formattedHistory = (history || []).map(h => ({
                id: h.id,
                product_id: h.product_id,
                price: parseFloat(h.price),
                stock: h.stock || 'In Stock',
                timestamp: h.recorded_at || h.timestamp || h.created_at || new Date().toISOString()
            }));

            // Format logs array
            const formattedLogs = (logs || []).map(l => ({
                id: l.id,
                product_id: l.product_id,
                outcome: l.outcome || (l.status ? l.status.toLowerCase() : 'success'),
                timestamp: l.created_at || l.timestamp || new Date().toISOString()
            }));

            return {
                id: prod.id,
                store_product_id: prod.store_product_id,
                name: prod.name,
                selected_option: prod.selected_option,
                current_price: prod.current_price,
                latest_price: formattedHistory.length > 0 ? formattedHistory[0].price : prod.current_price,
                latest_stock: formattedHistory.length > 0 ? formattedHistory[0].stock : 'In Stock',
                last_checked: formattedHistory.length > 0 ? formattedHistory[0].timestamp : null,
                price_history: formattedHistory, // Key guaranteed present in JSON payload
                logs: formattedLogs
            };
        }));

        res.json(detailedProducts);
    } catch (err) {
        console.error("Fatal error fetching products:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Pure Dynamic Scraper Engine Endpoint
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        if (!products || products.length === 0) {
            return res.json({ message: "No products to scrape", results: [] });
        }

        // Live mock store HTML fetch
        const response = await axios.get(MOCK_STORE_URL, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            timeout: 15000 
        });

        const $ = cheerio.load(response.data);
        let results = [];

        for (const prod of products) {
            let scrapedPrice = null;
            let stock = 'In Stock';
            const currentTime = new Date().toISOString();

            try {
                // Strict isolation: Find specific item by name, then extract price in that card only
                $('h1, h2, h3, h4, h5, p, span, div').each((i, el) => {
                    const text = $(el).children().remove().end().text().trim().toLowerCase();
                    
                    if (scrapedPrice === null && prod.name && text === prod.name.toLowerCase()) {
                        const card = $(el).closest('.product, .product-item, .card, .product-card, div[class*="product"], div[class*="item"]');
                        
                        const priceElement = card.find('.price, .amount, [class*="price"]').first();
                        let priceText = priceElement.length ? priceElement.text() : '';

                        if (!priceText) {
                            const matchDollar = card.text().match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
                            if (matchDollar) priceText = matchDollar[0];
                        }

                        const match = priceText.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
                        if (match) {
                            const val = parseFloat(match[1]);
                            if (!isNaN(val) && val > 0) {
                                scrapedPrice = val;
                            }
                        }
                    }
                });

                // Fallback: Name pattern regex search
                if (scrapedPrice === null) {
                    const bodyText = $('body').text();
                    const escaped = prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escaped}[^$]{0,100}\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)`, 'i');
                    const match = bodyText.match(regex);
                    if (match) {
                        scrapedPrice = parseFloat(match[1]);
                    }
                }

                if (scrapedPrice === null || isNaN(scrapedPrice)) {
                    throw new Error(`Real-time price could not be located in HTML for: ${prod.name}`);
                }

                // Match with integer ID '1' or String prod.id
                const targetNumericId = prod.store_product_id ? prod.store_product_id.replace(/\D/g, '') : null;
                const targetId = targetNumericId || String(prod.id);

                // 1. Insert genuine scraped price directly into price_history
                const { error: histInsertErr } = await supabase.from('price_history').insert([{
                    product_id: targetId,
                    price: scrapedPrice,
                    stock: stock,
                    recorded_at: currentTime,
                    timestamp: currentTime
                }]);

                if (histInsertErr) {
                    console.error("Price history insert error:", histInsertErr);
                    throw histInsertErr;
                }

                // 2. Update current_price in products table
                await supabase
                    .from('products')
                    .update({ current_price: scrapedPrice })
                    .eq('id', prod.id);

                // 3. Log success
                await supabase.from('scrape_logs').insert([{
                    product_id: targetId,
                    outcome: 'success',
                    status: 'SUCCESS',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'success', price: scrapedPrice, timestamp: currentTime });

            } catch (itemErr) {
                console.error(`Scrape failed for ${prod.name}:`, itemErr.message);

                const targetNumericId = prod.store_product_id ? prod.store_product_id.replace(/\D/g, '') : null;
                const targetId = targetNumericId || String(prod.id);

                await supabase.from('scrape_logs').insert([{
                    product_id: targetId,
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
        console.error("Scrape cycle failed:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});