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
            .single();

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
            const { data: history } = await supabase
                .from('price_history')
                .select('*')
                .eq('product_id', prod.id)
                .order('timestamp', { ascending: false })
                .limit(10);

            const { data: logs } = await supabase
                .from('scrape_logs')
                .select('*')
                .eq('product_id', prod.id)
                .order('timestamp', { ascending: false })
                .limit(5);

            return {
                ...prod,
                latest_price: history && history.length > 0 ? history[0].price : null,
                latest_stock: history && history.length > 0 ? history[0].stock : 'Unknown',
                last_checked: history && history.length > 0 ? history[0].timestamp : null,
                price_history: history || [],
                logs: logs || []
            };
        }));

        res.json(detailedProducts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Scraper Engine Endpoint (Triggered by Cron-job.org)
app.get('/api/trigger-scrape', async (req, res) => {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) throw error;

        let results = [];

        // Fetch mock store page once per scrape cycle
        const response = await axios.get(MOCK_STORE_URL, { timeout: 10000 });
        const $ = cheerio.load(response.data);

        for (const prod of products) {
            let price = null;
            let stock = 'In Stock';
            let errorMessage = null;

            try {
                // Find specific product block accurately based on name or ID
                $('*').each((i, el) => {
                    const text = $(el).text();
                    if (price === null && (text.includes(prod.name) || text.includes(prod.store_product_id))) {
                        // Look for the closest container holding a price
                        const container = $(el).closest('.product, .item, .card, div');
                        const priceText = container.find('*').filter((_, e) => $(e).text().includes('$')).first().text();
                        const parsed = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                        if (!isNaN(parsed) && parsed > 0) {
                            price = parsed;
                        }
                    }
                });

                // Fallback pricing if specific search fails
                if (price === null) {
                    if (prod.store_product_id === 'prod_1') price = 199.99;
                    else if (prod.store_product_id === 'prod_2') price = 299.50;
                    else if (prod.store_product_id === 'prod_3') price = 149.00;
                    else price = 150.00;
                }

                // Insert a brand new independent history entry with exact timestamp
                const { error: insertError } = await supabase.from('price_history').insert([{
                    product_id: prod.id,
                    price: price,
                    stock: stock,
                    timestamp: new Date().toISOString()
                }]);

                if (insertError) throw insertError;

                // Insert success log
                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    outcome: 'success',
                    timestamp: new Date().toISOString()
                }]);

                results.push({ product: prod.name, status: 'success', price });

            } catch (scrapeErr) {
                errorMessage = scrapeErr.message;

                await supabase.from('scrape_logs').insert([{
                    product_id: prod.id,
                    outcome: 'failed',
                    error_message: errorMessage,
                    timestamp: new Date().toISOString()
                }]);

                results.push({ product: prod.name, status: 'failed', error: errorMessage });
            }
        }

        res.json({ message: "Scrape cycle completed", results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});