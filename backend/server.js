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
            const validIds = [String(prod.id)];
            if (prod.store_product_id) validIds.push(String(prod.store_product_id));

            // Fetch price history (Matching product's UUID or store_product_id)
            const { data: history, error: histErr } = await supabase
                .from('price_history')
                .select('*')
                .in('product_id', validIds)
                .order('recorded_at', { ascending: false })
                .limit(30);

            if (histErr) console.error("History fetch error:", histErr);

            // Fetch scrape logs
            const { data: logs, error: logErr } = await supabase
                .from('scrape_logs')
                .select('*')
                .in('product_id', validIds)
                .order('created_at', { ascending: false })
                .limit(10);

            if (logErr) console.error("Logs fetch error:", logErr);

            const normalizedHistory = (history || []).map(h => ({
                ...h,
                timestamp: h.recorded_at || h.timestamp || h.created_at
            }));

            const normalizedLogs = (logs || []).map(l => ({
                ...l,
                outcome: l.outcome || (l.status ? l.status.toLowerCase() : 'success'),
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

// Real-Time Dynamic Scraper Engine Endpoint
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        if (!products || products.length === 0) {
            return res.json({ message: "No products to scrape", results: [] });
        }

        // Live fetch from mock store website
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
                        // Traverse up to find the closest single product card container
                        const card = $(el).closest('.product, .product-item, .card, .product-card, div[class*="product"], div[class*="item"]');
                        
                        // Look for price elements specifically inside this container
                        const priceElement = card.find('.price, .amount, [class*="price"]').first();
                        let priceText = priceElement.length ? priceElement.text() : '';

                        if (!priceText) {
                            // Find any text with dollar currency format inside card
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

                // If not found in card, search exact text pattern: "Product Name ... $XX.XX"
                if (scrapedPrice === null) {
                    const bodyText = $('body').text();
                    const escaped = prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escaped}[^$]{0,100}\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)`, 'i');
                    const match = bodyText.match(regex);
                    if (match) {
                        scrapedPrice = parseFloat(match[1]);
                    }
                }

                // If still not found, throw error (Do NOT fake or hardcode any price)
                if (scrapedPrice === null || isNaN(scrapedPrice)) {
                    throw new Error(`Real-time price could not be located in HTML for: ${prod.name}`);
                }

                // 1. Insert genuine scraped price directly into price_history
                const { error: histInsertErr } = await supabase.from('price_history').insert([{
                    product_id: String(prod.id),
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
                    product_id: String(prod.id),
                    outcome: 'success',
                    status: 'SUCCESS',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'success', price: scrapedPrice, timestamp: currentTime });

            } catch (itemErr) {
                console.error(`Scrape failed for ${prod.name}:`, itemErr.message);

                await supabase.from('scrape_logs').insert([{
                    product_id: String(prod.id),
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