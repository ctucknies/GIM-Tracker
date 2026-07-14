const https = require('https');
const fs = require('fs');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'DryKeys OSRS Tracker - Local App' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function main() {
    // 1. Load the wiki's complete collection log item list
    console.log('Loading wiki collection log item data...');
    const wikiData = JSON.parse(fs.readFileSync('clog_items_wiki.json', 'utf-8'));

    // Build a map of itemId -> { name, tabs }
    const clogItemsById = new Map();
    const clogItemsByName = new Map();
    const keys = Object.keys(wikiData);
    for (const key of keys) {
        const entry = wikiData[key];
        if (entry && entry.id && entry.name) {
            clogItemsById.set(entry.id, { name: entry.name, tabs: entry.tabs || [] });
            // Also map by lowercase name for fuzzy matching
            clogItemsByName.set(entry.name.toLowerCase(), { id: entry.id, name: entry.name, tabs: entry.tabs || [] });
        }
    }
    console.log(`Loaded ${clogItemsById.size} collection log items from wiki`);

    // 2. Load loot tracker data (already filtered to DAn72YKI profile)
    console.log('Loading loot tracker data...');
    const lootData = JSON.parse(fs.readFileSync('loot_data.json', 'utf-8'));

    // 3. Fetch GE prices
    console.log('Fetching GE prices...');
    const prices = await fetchJson('https://prices.runescape.wiki/api/v1/osrs/latest');

    // 4. Fetch item mapping for names
    console.log('Fetching item name mapping...');
    const mapping = await fetchJson('https://prices.runescape.wiki/api/v1/osrs/mapping');
    const itemNames = {};
    for (const item of mapping) {
        itemNames[item.id] = item.name;
    }

    // 5. Cross-reference: find collection log items in your loot tracker
    // Build: itemId -> { totalQuantity, firstDate, lastDate, sources }
    const obtainedFromTracker = new Map();

    for (const entry of lootData) {
        for (const drop of entry.drops) {
            if (!clogItemsById.has(drop.itemId)) continue; // Skip non-clog items

            if (!obtainedFromTracker.has(drop.itemId)) {
                obtainedFromTracker.set(drop.itemId, {
                    totalQuantity: 0,
                    firstDate: entry.first,
                    lastDate: entry.last,
                    sources: []
                });
            }
            const record = obtainedFromTracker.get(drop.itemId);
            record.totalQuantity += drop.quantity;
            // Use earliest first date across all sources
            if (entry.first && (!record.firstDate || entry.first < record.firstDate)) {
                record.firstDate = entry.first;
            }
            record.sources.push({ name: entry.name, type: entry.type, quantity: drop.quantity });
        }
    }

    console.log(`Found ${obtainedFromTracker.size} collection log items in your loot tracker`);

    // 6. Load WikiSync obtained data (parsed from wiki MHTML export)
    let wikiObtained = new Set();
    if (fs.existsSync('wiki_clog_obtained.json')) {
        const wikiData2 = JSON.parse(fs.readFileSync('wiki_clog_obtained.json', 'utf-8'));
        wikiObtained = new Set(wikiData2.obtainedIds);
        console.log(`Loaded ${wikiObtained.size} obtained items from WikiSync wiki export`);
    }

    // 7. Build the final collection log output
    const obtained = []; // Items with dates (from loot tracker + wiki confirmed)
    const obtainedNoDate = []; // Items obtained (wiki) but no loot tracker date
    const missing = []; // Items not obtained

    for (const [itemId, info] of clogItemsById.entries()) {
        const priceData = prices.data[itemId];
        const price = priceData ? Math.round(((priceData.high || 0) + (priceData.low || 0)) / 2) : 0;

        const baseEntry = {
            itemId,
            name: info.name,
            tab: info.tabs[0] || 'Unknown',
            price
        };

        const hasTrackerData = obtainedFromTracker.has(itemId);
        const isWikiObtained = wikiObtained.has(itemId);

        if (hasTrackerData && isWikiObtained) {
            // Have it, and we know when we got it
            const tracker = obtainedFromTracker.get(itemId);
            obtained.push({
                ...baseEntry,
                quantity: tracker.totalQuantity,
                date: tracker.firstDate,
                sources: tracker.sources
            });
        } else if (hasTrackerData) {
            // Loot tracker has it (maybe wiki didn't sync this one)
            const tracker = obtainedFromTracker.get(itemId);
            obtained.push({
                ...baseEntry,
                quantity: tracker.totalQuantity,
                date: tracker.firstDate,
                sources: tracker.sources
            });
        } else if (isWikiObtained) {
            // Wiki confirms we have it, but no date from loot tracker
            obtainedNoDate.push({
                ...baseEntry,
                quantity: 1,
                date: null,
                sources: [{ name: 'WikiSync confirmed', type: 'WIKISYNC', quantity: 1 }]
            });
        } else {
            missing.push(baseEntry);
        }
    }

    // Sort obtained by price (highest first)
    obtained.sort((a, b) => b.price - a.price);
    obtainedNoDate.sort((a, b) => b.price - a.price);
    missing.sort((a, b) => b.price - a.price);

    const result = {
        username: 'Drykeys',
        totalClogItems: clogItemsById.size,
        obtainedCount: obtained.length + obtainedNoDate.length,
        obtained,       // Items with dates from loot tracker
        obtainedNoDate, // Items manually marked, no date
        missing,        // Items not yet obtained
        generatedAt: new Date().toISOString()
    };

    fs.writeFileSync('collection_log.json', JSON.stringify(result, null, 2));

    console.log(`\n=== Collection Log Summary ===`);
    console.log(`Total clog items in game: ${clogItemsById.size}`);
    console.log(`Obtained (with date): ${obtained.length}`);
    console.log(`Obtained (no date): ${obtainedNoDate.length}`);
    console.log(`Total obtained: ${obtained.length + obtainedNoDate.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`\nTop 10 obtained (with date) by value:`);
    obtained.slice(0, 10).forEach(item => {
        const src = item.sources.map(s => s.name).filter((v, i, a) => a.indexOf(v) === i).join(', ');
        console.log(`  ${item.name} - ${item.price.toLocaleString()} gp (${new Date(item.date).toLocaleDateString()}) from ${src}`);
    });
    console.log(`\nTop 10 obtained (no date) by value:`);
    obtainedNoDate.slice(0, 10).forEach(item => {
        console.log(`  ${item.name} - ${item.price.toLocaleString()} gp`);
    });
}

main().catch(console.error);
