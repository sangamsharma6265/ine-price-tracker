# INE Price Tracker - Automated E-Commerce Monitor

A full-stack, resilient price monitoring pipeline designed to track dynamic product pricing, variant options, stock statuses, and historical fluctuations across scheduled intervals with complete audit logging.

---

## 🌐 Live URLs

- **Frontend (Vercel):** [https://ine-price-tracker-ebon-eight.vercel.app](https://ine-price-tracker-ebon-eight.vercel.app)
- **Backend (Render):** [https://ine-price-tracker-backend.onrender.com](https://ine-price-tracker-backend.onrender.com)
- **Database:** Supabase PostgreSQL

---

## 🚀 Key Features & Rubric Compliance

1. **Automated & Manual Scraping:**
   - External cron scheduled via `cron-job.org` running every 2 hours to keep the Render free-tier active and log periodic data.
   - On-demand instant scrape trigger from the frontend UI (`Run Scrape Now`).
2. **Standard 7-Column CSV Export:**
   - Generates exact rubric headers: `store_product_id`, `product_name`, `selected_option`, `timestamp`, `price`, `stock`, `outcome`.
   - Strictly conforms to ISO 8601 UTC timestamps (with trailing `Z`).
   - Honest failure logging: Whenever scraping fails or runs into timeouts, `price` and `stock` remain completely empty (`""`), avoiding misleading fallback data.
3. **Database Architecture:**
   - Normalised PostgreSQL schema using Supabase (`products`, `price_history`, and `scrape_logs`).
   - Tracks option-level pricing (e.g., variant options, color, storage) rather than just parent product prices.

---

## 🛠️ Tech Stack & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Backend Setup
```bash
cd backend
npm install