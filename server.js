const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PLAYER_USERNAME = 'Drykeys';
const PLAYERS = ['Drykeys', 'Salisa Taka'];

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function fetchExternal(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'DryKeys OSRS Tracker - Local Personal App' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Failed to parse JSON: ' + e.message)); }
            });
        }).on('error', reject);
    });
}

async function handleRefreshClog(res, playerName) {
    try {
        console.log(`Refreshing collection log for "${playerName}" from WikiSync...`);

        // 1. Fetch from WikiSync API (single call)
        const syncData = await fetchExternal(`https://sync.runescape.wiki/runelite/player/${encodeURIComponent(playerName)}/STANDARD`);
        const obtainedIds = syncData.collection_log || [];
        console.log(`WikiSync returned ${obtainedIds.length} obtained item IDs`);

        // 2. Load wiki clog item data
        const wikiItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'clog_items_wiki.json'), 'utf-8'));
        const clogItemsById = new Map();
        for (const key of Object.keys(wikiItems)) {
            const entry = wikiItems[key];
            if (entry && entry.id && entry.name) {
                clogItemsById.set(entry.id, { name: entry.name, tabs: entry.tabs || [] });
            }
        }

        // 3. Load loot tracker data for dates (only for Drykeys)
        let lootData = [];
        if (playerName.toLowerCase() === 'drykeys' && fs.existsSync(path.join(__dirname, 'loot_data.json'))) {
            lootData = JSON.parse(fs.readFileSync(path.join(__dirname, 'loot_data.json'), 'utf-8'));
        }

        // Build tracker map: itemId -> { firstDate, sources }
        const trackerMap = new Map();
        for (const entry of lootData) {
            for (const drop of entry.drops) {
                if (!clogItemsById.has(drop.itemId)) continue;
                if (!trackerMap.has(drop.itemId)) {
                    trackerMap.set(drop.itemId, { totalQuantity: 0, firstDate: entry.first, sources: [] });
                }
                const record = trackerMap.get(drop.itemId);
                record.totalQuantity += drop.quantity;
                if (entry.first && (!record.firstDate || entry.first < record.firstDate)) {
                    record.firstDate = entry.first;
                }
                record.sources.push({ name: entry.name, type: entry.type, quantity: drop.quantity });
            }
        }

        // 4. Fetch GE prices
        const prices = await fetchExternal('https://prices.runescape.wiki/api/v1/osrs/latest');

        // 5. Build collection log
        const obtainedSet = new Set(obtainedIds);
        const obtained = [];
        const obtainedNoDate = [];
        const missing = [];

        for (const [itemId, info] of clogItemsById.entries()) {
            const priceData = prices.data[itemId];
            const price = priceData ? Math.round(((priceData.high || 0) + (priceData.low || 0)) / 2) : 0;
            const baseEntry = { itemId, name: info.name, tab: info.tabs[0] || 'Unknown', price };

            const hasTracker = trackerMap.has(itemId);
            const isObtained = obtainedSet.has(itemId);

            if (isObtained && hasTracker) {
                const t = trackerMap.get(itemId);
                obtained.push({ ...baseEntry, quantity: t.totalQuantity, date: t.firstDate, sources: t.sources });
            } else if (hasTracker) {
                const t = trackerMap.get(itemId);
                obtained.push({ ...baseEntry, quantity: t.totalQuantity, date: t.firstDate, sources: t.sources });
            } else if (isObtained) {
                obtainedNoDate.push({ ...baseEntry, quantity: 1, date: null, sources: [{ name: 'WikiSync confirmed', type: 'WIKISYNC', quantity: 1 }] });
            } else {
                missing.push(baseEntry);
            }
        }

        obtained.sort((a, b) => b.price - a.price);
        obtainedNoDate.sort((a, b) => b.price - a.price);
        missing.sort((a, b) => b.price - a.price);

        // 6. Build categories (grouped by tab/boss)
        const categories = {};
        const allItems = [...obtained, ...obtainedNoDate, ...missing];
        for (const item of allItems) {
            const cat = item.tab;
            if (!categories[cat]) {
                categories[cat] = { name: cat, obtained: 0, total: 0, items: [] };
            }
            categories[cat].total++;
            if (item.quantity !== undefined || item.sources) {
                categories[cat].obtained++;
            }
            categories[cat].items.push(item);
        }
        // Sort categories alphabetically, items within by price
        const sortedCategories = Object.values(categories).sort((a, b) => a.name.localeCompare(b.name));
        for (const cat of sortedCategories) {
            cat.items.sort((a, b) => b.price - a.price);
        }

        const result = {
            username: playerName,
            totalClogItems: clogItemsById.size,
            obtainedCount: obtained.length + obtainedNoDate.length,
            obtained,
            obtainedNoDate,
            missing,
            categories: sortedCategories,
            generatedAt: new Date().toISOString()
        };

        const filename = `collection_log_${playerName.toLowerCase().replace(/\s+/g, '_')}.json`;
        fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(result, null, 2));
        // Also write as the generic file if it's the default player
        if (playerName.toLowerCase() === 'drykeys') {
            fs.writeFileSync(path.join(__dirname, 'collection_log.json'), JSON.stringify(result, null, 2));
        }
        console.log(`Done! ${obtained.length + obtainedNoDate.length} obtained for ${playerName}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, obtained: obtained.length + obtainedNoDate.length, total: clogItemsById.size, generatedAt: result.generatedAt }));
    } catch (err) {
        console.error('Refresh failed:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

const server = http.createServer((req, res) => {
    // API endpoint for refreshing collection log
    if (req.url.startsWith('/api/refresh-clog') && req.method === 'POST') {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const player = url.searchParams.get('player') || PLAYER_USERNAME;
        handleRefreshClog(res, player);
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
