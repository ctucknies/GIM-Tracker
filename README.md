# OSRS GIM Tracker

Collection log and stats tracker for our Group Ironman team. Pulls live player data from [Wise Old Man](https://wiseoldman.net) and collection log data from [WikiSync](https://sync.runescape.wiki).

## Players

- **DryKeys**
- **Salisa Taka**

## Features

- Player stats (skills, boss KC, activities, achievements)
- Full collection log (310/1706 items tracked for DryKeys)
- Per-boss/source category view with KC counts
- Group merged view showing combined progress and who has what
- Item search across all categories
- GE price values from the OSRS Wiki

## Data Sources

| Source | Used For |
|--------|----------|
| [Wise Old Man API](https://docs.wiseoldman.net) | Skills, boss KC, activities, achievements |
| [WikiSync API](https://sync.runescape.wiki) | Collection log obtained items |
| [OSRS Wiki Prices](https://prices.runescape.wiki) | GE item values |
| [OSRS Wiki Module](https://oldschool.runescape.wiki/w/Module:Collection_log/data.json) | Complete collection log item list |
| RuneLite Loot Tracker | Drop source attribution (local only) |

## Local Development

```bash
node server.js
```

Open `http://localhost:8080`. Use the Refresh button to pull fresh data from WikiSync.

## Updating Data

1. Run `node server.js` locally
2. Click Refresh in the Collection Log tab for each player
3. Commit the updated JSON files
4. Push — GitHub Pages auto-deploys
