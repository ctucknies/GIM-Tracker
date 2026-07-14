---
inclusion: manual
---

# Refresh Collection Log Data

This steering file describes the process to update the collection log data for the OSRS player tracker app. Run this whenever the player wants fresh data (new drops obtained, price updates, etc.)

## Prerequisites

The player must have:
1. RuneLite with the WikiSync plugin installed
2. Synced their collection log in-game (open collection log → click WikiSync button)
3. Visited https://oldschool.runescape.wiki/w/Collection_log/Table, entered their username, and saved the page as MHTML to the workspace root

## Data Sources

- **WikiSync API** (`https://sync.runescape.wiki/runelite/player/Drykeys/STANDARD`) — Returns the full player data including a `collection_log` field which is a flat array of obtained item IDs. This is the authoritative source for what items the player has obtained. Called via a button in the UI (single request).
- **RuneLite Loot Tracker** (`C:\Users\conno\.runelite\profiles2\$rsprofile--1.properties`) — Contains drop timestamps. Only the `DAn72YKI` profile ID belongs to this player (Drykeys)
- **OSRS Wiki item data** (`clog_items_wiki.json`) — The full list of all 1706+ collection log items with IDs and tab categories. Source: `https://oldschool.runescape.wiki/w/Module:Collection_log/data.json?action=raw`
- **OSRS Wiki GE prices** (`https://prices.runescape.wiki/api/v1/osrs/latest`) — Current item values
- **OSRS Wiki item mapping** (`https://prices.runescape.wiki/api/v1/osrs/mapping`) — Maps item IDs to names

## Refresh Methods

### Method 1: UI Button (preferred)
Click "Refresh from WikiSync" button in the Collection Log tab. This:
1. Calls `POST /api/refresh-clog` on the local server
2. Server hits the WikiSync API ONCE to get obtained item IDs
3. Cross-references with loot tracker for dates
4. Fetches current GE prices
5. Writes `collection_log.json`
6. Page reloads with fresh data

### Method 2: Manual scripts (for loot tracker updates)

### Method 2: Manual scripts (for loot tracker updates)

### Step 1: Extract loot tracker data

Extract only the `DAn72YKI` profile entries from RuneLite:

```
Select-String -Path 'C:\Users\conno\.runelite\profiles2\$rsprofile--1.properties' -Pattern "loottracker" -SimpleMatch | ForEach-Object { $_.Line } | Out-File -FilePath "loot_raw.txt" -Encoding UTF8
```

Then run `node parse_loot.js` — this filters to only `DAn72YKI` profile, parses the Java properties format, resolves item IDs to names, and writes `loot_data.json`.

### Step 2: Parse the wiki MHTML export

Run `node parse_wiki_clog.js` — this extracts all item rows from the saved wiki page, identifies obtained items by the `wikisync-completed` CSS class on `<tr data-item-id="...">` rows, and writes `wiki_clog_obtained.json`.

### Step 3: Build the final collection log

Run `node build_collection.js` — this:
1. Loads the wiki's complete collection log item list (`clog_items_wiki.json`)
2. Cross-references with loot tracker data for timestamps
3. Cross-references with wiki obtained data for confirmed items
4. Fetches current GE prices
5. Outputs `collection_log.json` with three sections:
   - `obtained` — items with dates (from loot tracker)
   - `obtainedNoDate` — items confirmed obtained but no timestamp
   - `missing` — items not yet obtained

### Step 4: Restart the server

```
node server.js
```

The app at http://localhost:8080 will show updated data.

## Important Notes

- The player's RuneLite profile ID is `DAn72YKI`. Other profiles (`F0_pybK_`, `GE_pybK_`, `X98Rcru5`) are alts/other accounts — do NOT include them.
- The player's previous display names: `QQQ 420 Call`, `BuyAnthropic`, `Drykeys`
- The loot tracker `first` field gives the timestamp of the first recorded drop — this is the "date obtained" for collection log items
- Items in `obtainedNoDate` were obtained before the loot tracker was active or during periods it wasn't running
- The wiki collection log data file can be refreshed from: `https://oldschool.runescape.wiki/w/Module:Collection_log/data.json?action=raw`
