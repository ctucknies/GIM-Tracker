const fs = require('fs');
const https = require('https');

// Read raw loot data
const raw = fs.readFileSync('loot_raw.txt', 'utf-8');
const lines = raw.split('\n').filter(l => l.trim());

// Parse the loot tracker entries
const lootEntries = [];

for (const line of lines) {
    // Only include entries from the DAn72YKI profile (DryKeys main account)
    if (!line.includes('rsprofile.DAn72YKI.')) continue;

    // Format: loottracker.rsprofile.XXXX.drops_TYPE_Name={"type"\:"NPC",...}
    // Split on first = to get the JSON value
    const eqIdx = line.indexOf('={');
    if (eqIdx === -1) continue;

    // The value part has Java properties escaping: \: for colons, \\ for backslashes
    let jsonStr = line.substring(eqIdx + 1)
        .replace(/\\:/g, ':')
        .replace(/\\,/g, ',')
        .replace(/\\\\/g, '\\');

    try {
        const data = JSON.parse(jsonStr);
        lootEntries.push(data);
    } catch (e) {
        // Some entries might have tricky escaping, skip them
        console.error('Failed to parse:', jsonStr.substring(0, 80));
    }
}

console.log(`Parsed ${lootEntries.length} loot entries`);

// Collect all unique item IDs
const allItemIds = new Set();
for (const entry of lootEntries) {
    if (entry.drops) {
        // Drops are stored as flat array: [itemId, quantity, itemId, quantity, ...]
        for (let i = 0; i < entry.drops.length; i += 2) {
            allItemIds.add(entry.drops[i]);
        }
    }
}

console.log(`Found ${allItemIds.size} unique item IDs`);

// Fetch item names from OSRS Wiki API
function fetchItemMapping() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'prices.runescape.wiki',
            path: '/api/v1/osrs/mapping',
            headers: { 'User-Agent': 'DryKeys OSRS Tracker - Local App' }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('Fetching item name mappings from OSRS Wiki...');
    const mapping = await fetchItemMapping();

    // Build ID -> name lookup
    const itemNames = {};
    for (const item of mapping) {
        itemNames[item.id] = item.name;
    }

    console.log(`Loaded ${Object.keys(itemNames).length} item names`);

    // Build structured loot data
    const structuredLoot = lootEntries.map(entry => {
        const drops = [];
        if (entry.drops) {
            for (let i = 0; i < entry.drops.length; i += 2) {
                const itemId = entry.drops[i];
                const quantity = entry.drops[i + 1];
                drops.push({
                    itemId,
                    name: itemNames[itemId] || `Unknown (${itemId})`,
                    quantity
                });
            }
        }

        return {
            type: entry.type,
            name: entry.name,
            kills: entry.kills,
            first: entry.first ? new Date(entry.first).toISOString() : null,
            last: entry.last ? new Date(entry.last).toISOString() : null,
            drops: drops.sort((a, b) => b.quantity - a.quantity)
        };
    });

    // Sort by kills descending
    structuredLoot.sort((a, b) => b.kills - a.kills);

    // Write the processed data
    fs.writeFileSync('loot_data.json', JSON.stringify(structuredLoot, null, 2));
    console.log(`Written loot_data.json with ${structuredLoot.length} entries`);

    // Print top sources
    console.log('\nTop 15 loot sources by kills:');
    structuredLoot.slice(0, 15).forEach(entry => {
        console.log(`  ${entry.name} (${entry.type}) - ${entry.kills} kills, ${entry.drops.length} unique drops`);
    });
}

main().catch(console.error);
