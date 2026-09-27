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

// Get All Tracked Products with Full History & Logs
app.get('/api/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        const detailedProducts = await Promise.all(products.map(async (prod) => {
            // Dual lookup taaki database UUID ya store_product_id dono se history match ho sake
            const { data: history, error: histErr } = await supabase
                .from('price_history')
                .select('*')
                .or(`product_id.eq.${prod.id},product_id.eq.${prod.store_product_id}`)
                .order('recorded_at', { ascending: false })
                .limit(30);

            if (histErr) console.error("History fetch error:", histErr);

            const { data: logs, error: logErr } = await supabase
                .from('scrape_logs')
                .select('*')
                .or(`product_id.eq.${prod.id},product_id.eq.${prod.store_product_id}`)
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

// Real-Time Scraper Engine Endpoint
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
                // 1. Specific product cards ko target karna (bina generic wrappers ko pick kiye)
                $('.product, .product-item, .card, [data-product-id], .product-card').each((i, card) => {
                    const cardText = $(card).text();
                    
                    const isMatch = (prod.name && cardText.toLowerCase().includes(prod.name.toLowerCase())) ||
                                    (prod.store_product_id && cardText.includes(prod.store_product_id));

                    if (scrapedPrice === null && isMatch) {
                        // Card ke andar specific price class find karo
                        const priceEl = $(card).find('.price, .amount, .product-price, [data-price]').first();
                        let rawText = priceEl.length ? priceEl.text() : '';

                        if (!rawText) {
                            const dollarEl = $(card).find('span, p, b, strong, div').filter((_, el) => {
                                const t = $(el).children().remove().end().text().trim();
                                return t.startsWith('$') \vert{}\vert{} t.includes('$');
                            }).first();
                            rawText = dollarEl.text();
                        }

                        // Dollar amount extract karo
                        const match = rawText.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
                        if (match) {
                            const parsed = parseFloat(match[1]);
                            if (!isNaN(parsed) && parsed > 0) {
                                scrapedPrice = parsed;
                            }
                        }
                    }
                });

                // 2. Agar specific card selector na mile, toh product name ke directly baad aane wala price lo
                if (scrapedPrice === null) {
                    const bodyText = $('body').text();
                    const escapedName = prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const dynamicRegex = new RegExp(`${escapedName}[\\s\\S]*?\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)`, 'i');
                    const match = bodyText.match(dynamicRegex);
                    if (match) {
                        const parsed = parseFloat(match[1]);
                        if (!isNaN(parsed) && parsed > 0) {
                            scrapedPrice = parsed;
                        }
                    }
                }

                if (scrapedPrice === null || isNaN(scrapedPrice)) {
                    throw new Error(`Real-time price could not be extracted from page for ${prod.name}`);
                }

                // 3. Database mein independent historical row insert karo
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

                // 4. Products table ka current_price update karo
                await supabase
                    .from('products')
                    .update({ current_price: scrapedPrice })
                    .eq('id', prod.id);

                // 5. Scrape execution log create karo
                await supabase.from('scrape_logs').insert([{
                    product_id: String(prod.id),
                    outcome: 'success',
                    status: 'SUCCESS',
                    timestamp: currentTime,
                    created_at: currentTime
                }]);

                results.push({ product: prod.name, status: 'success', price: scrapedPrice, timestamp: currentTime });

            } catch (itemErr) {
                console.error(`Scrape failed for product ${prod.name}:`, itemErr.message);

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
        console.error("Trigger scrape error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});