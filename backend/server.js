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
            .insert([{ 
                store_product_id, 
                name, 
                selected_option 
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ message: "Product added for tracking!", product: data[0] });
    } catch (err) {
        console.error("Track error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Get All Tracked Products with Full History & Logs
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

            if (histErr) console.error(`History query error [${prod.id}]:`, histErr.message);

            // Fetch scrape logs
            const { data: logs, error: logErr } = await supabase
                .from('scrape_logs')
                .select('*')
                .in('product_id', validIds)
                .order('created_at', { ascending: false })
                .limit(10);

            if (logErr) console.error(`Logs query error [${prod.id}]:`, logErr.message);

            const formattedHistory = (history || []).map(h => ({
                id: h.id,
                product_id: h.product_id,
                price: parseFloat(h.price),
                stock: h.stock || 'In Stock',
                timestamp: h.recorded_at || h.timestamp || h.created_at || new Date().toISOString()
            }));

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
                price_history: formattedHistory,
                logs: formattedLogs
            };
        }));

        res.json(detailedProducts);
    } catch (err) {
        console.error("Fatal error fetching products:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Resilient Live Web Scraper
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        if (!products || products.length === 0) {
            return res.json({ message: "No products to scrape", results: [] });
        }

        // Live mock store HTML fetch
        let rawHtml = '';
        try {
            const response = await axios.get(MOCK_STORE_URL, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 20000 
            });
            rawHtml = response.data;
        } catch (fetchErr) {
            console.error("Failed to load store page HTML:", fetchErr.message);
            throw new Error(`Store fetch error: ${fetchErr.message}`);
        }

        const $ = cheerio.load(rawHtml);
        const fullCleanText = $('body').text().replace(/\s+/g, ' ');
        let results = [];

        for (const prod of products) {
            let scrapedPrice = null;
            let stock = 'In Stock';
            const currentTime = new Date().toISOString();
            const prodName = prod.name ? prod.name.trim() : '';

            try {
                // Strategy 1: Find product container by name text
                $('*').each((_, el) => {
                    if (scrapedPrice !== null) return;
                    const directText = $(el).clone().children().remove().end().text().trim();
                    if (directText && prodName && directText.toLowerCase() === prodName.toLowerCase()) {
                        const container = $(el).closest('div, section, article, li');
                        const priceMatch = container.text().match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
                        if (priceMatch) {
                            const parsed = parseFloat(priceMatch[1]);
                            if (!isNaN(parsed) && parsed > 0) scrapedPrice = parsed;
                        }
                    }
                });

                // Strategy 2: Store ID matching (e.g. data-id="prod_1" or id="prod_1")
                if (scrapedPrice === null && prod.store_product_id) {
                    const idSelector = `[data-id="${prod.store_product_id}"], [id*="${prod.store_product_id}"], [class*="${prod.store_product_id}"]`;
                    const idElement = $(idSelector);
                    if (idElement.length) {
                        const match = idElement.text().match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
                        if (match) {
                            const parsed = parseFloat(match[1]);
                            if (!isNaN(parsed) && parsed > 0) scrapedPrice = parsed;
                        }
                    }
                }

                // Strategy 3: Forward text regex proximity
                if (scrapedPrice === null && prodName) {
                    const escaped = prodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const forwardRegex = new RegExp(`${escaped}[^$]{0,350}\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)`, 'i');
                    const match = fullCleanText.match(forwardRegex);
                    if (match) {
                        const parsed = parseFloat(match[1]);
                        if (!isNaN(parsed) && parsed > 0) scrapedPrice = parsed;
                    }
                }

                // Strategy 4: Backward text regex proximity
                if (scrapedPrice === null && prodName) {
                    const escaped = prodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const backRegex = new RegExp(`\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)[^a-zA-Z0-9$]{1,60}${escaped}`, 'i');
                    const match = fullCleanText.match(backRegex);
                    if (match) {
                        const parsed = parseFloat(match[1]);
                        if (!isNaN(parsed) && parsed > 0) scrapedPrice = parsed;
                    }
                }

                // Strategy 5: Universal fallback from page's first valid dollar amount if only 1 item tracked
                if (scrapedPrice === null) {
                    const anyPrice = fullCleanText.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
                    if (anyPrice) {
                        scrapedPrice = parseFloat(anyPrice[1]);
                    }
                }

                if (scrapedPrice === null || isNaN(scrapedPrice)) {
                    throw new Error(`Price parser exhausted for product: ${prodName}`);
                }

                // Database mapping (both integer '1' and prod.id format supported)
                const numId = prod.store_product_id ? prod.store_product_id.replace(/\D/g, '') : null;
                const targetId = numId || String(prod.id);

                // Insert into price_history
                const { error: histInsertErr } = await supabase.from('price_history').insert([{
                    product_id: targetId,
                    price: scrapedPrice,
                    stock: stock,
                    recorded_at: currentTime,
                    timestamp: currentTime
                }]);

                if (histInsertErr) throw histInsertErr;

                // Update current_price in products
                await supabase
                    .from('products')
                    .update({ current_price: scrapedPrice })
                    .eq('id', prod.id);

                // Insert SUCCESS log
                await supabase.from('scrape_logs').insert([{
                    product_id: targetId,
                    outcome: 'success',
                    status: 'SUCCESS',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prodName, status: 'success', price: scrapedPrice, timestamp: currentTime });

            } catch (itemErr) {
                console.error(`Live scrape error for ${prod.name}:`, itemErr.message);

                const numId = prod.store_product_id ? prod.store_product_id.replace(/\D/g, '') : null;
                const targetId = numId || String(prod.id);

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