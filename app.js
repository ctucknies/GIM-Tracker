const PLAYER = 'drykeys';
const API = 'https://api.wiseoldman.net/v2';
let currentPlayer = 'Drykeys';
let currentPlayerWom = null; // Store WOM data for current player

function fmt(n) { return n === -1 ? '—' : n.toLocaleString(); }

function catNameToBossKey(catName) {
    // Convert category name like "General Graardor" to WOM boss key "general_graardor"
    return catName.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

// Explicit mapping for category names that don't match WOM keys directly
const CAT_TO_WOM_KEY = {
    'barrows chests': 'barrows_chests',
    'chambers of xeric': 'chambers_of_xeric',
    'theatre of blood': 'theatre_of_blood',
    'tombs of amascut': 'tombs_of_amascut',
    'the gauntlet': 'the_gauntlet',
    'the nightmare': 'the_nightmare',
    'the leviathan': 'the_leviathan',
    'the whisperer': 'the_whisperer',
    'the inferno': 'the_inferno',
    'the fight caves': 'tzkal_zuk', // no direct match, try tztok_jad
    'fortis colosseum': 'sol_heredit',
    'callisto and artio': 'callisto',
    'venenatis and spindel': 'venenatis',
    "vet'ion and calvar'ion": 'vetion',
    'king black dragon': 'king_black_dragon',
    'kalphite queen': 'kalphite_queen',
    'corporeal beast': 'corporeal_beast',
    'dagannoth kings': 'dagannoth_rex', // use rex as proxy
    'giant mole': 'giant_mole',
    'grotesque guardians': 'grotesque_guardians',
    'alchemical hydra': 'alchemical_hydra',
    'thermonuclear smoke devil': 'thermonuclear_smoke_devil',
    'commander zilyana': 'commander_zilyana',
    'general graardor': 'general_graardor',
    "k'ril tsutsaroth": 'kril_tsutsaroth',
    "kree'arra": 'kreearra',
    'abyssal sire': 'abyssal_sire',
    'cerberus': 'cerberus',
    'phantom muspah': 'phantom_muspah',
    'duke sucellus': 'duke_sucellus',
    'vardorvis': 'vardorvis',
    'moons of peril': 'lunar_chests',
    'scorpia': 'scorpia',
    'crazy archaeologist': 'crazy_archaeologist',
    'chaos elemental': 'chaos_elemental',
    'chaos fanatic': 'chaos_fanatic',
    'kraken': 'kraken',
    'zulrah': 'zulrah',
    'vorkath': 'vorkath',
    'nex': 'nex',
    'sarachnis': 'sarachnis',
    'skotizo': 'skotizo',
    'hespori': 'hespori',
    'wintertodt': 'wintertodt',
    'tempoross': 'tempoross',
    'zalcano': 'zalcano',
    'scurrius': 'scurrius',
    'araxxor': 'araxxor',
    'obor': 'obor',
    'bryophyta': 'bryophyta',
    'deranged archaeologist': 'deranged_archaeologist',
    'guardians of the rift': 'guardians_of_the_rift',
    'hallowed sepulchre': 'hallowed_sepulchre',
    'tormented demons': 'tormented_demons',
    // Clue scrolls
    'beginner treasure trails': 'clue_scrolls_beginner',
    'easy treasure trails': 'clue_scrolls_easy',
    'medium treasure trails': 'clue_scrolls_medium',
    'hard treasure trails': 'clue_scrolls_hard',
    'elite treasure trails': 'clue_scrolls_elite',
    'master treasure trails': 'clue_scrolls_master',
    'hard treasure trails (rare)': 'clue_scrolls_hard',
    'elite treasure trails (rare)': 'clue_scrolls_elite',
    'master treasure trails (rare)': 'clue_scrolls_master',
    'shared treasure trail rewards': 'clue_scrolls_all',
    // Activities
    'last man standing': 'last_man_standing',
    'soul wars': 'soul_wars',
    'pest control': 'pest_control',
    'barbarian assault': 'barbarian_assault',
    'castle wars': 'castle_wars',
    'fishing trawler': 'fishing_trawler',
};

function getKcForCategory(catName, womData) {
    if (!womData?.latestSnapshot?.data) return null;
    const bosses = womData.latestSnapshot.data.bosses || {};
    const activities = womData.latestSnapshot.data.activities || {};
    const catLower = catName.toLowerCase();

    // Try explicit mapping first
    const mappedKey = CAT_TO_WOM_KEY[catLower];
    if (mappedKey) {
        if (bosses[mappedKey] && bosses[mappedKey].kills > 0) return bosses[mappedKey].kills;
        if (activities[mappedKey] && activities[mappedKey].score > 0) return activities[mappedKey].score;
    }

    // Try direct conversion
    const key = catLower.replace(/['']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (bosses[key] && bosses[key].kills > 0) return bosses[key].kills;
    if (activities[key] && activities[key].score > 0) return activities[key].score;

    // Try partial match on bosses
    for (const [bossKey, data] of Object.entries(bosses)) {
        if (data.kills > 0 && (bossKey.includes(key) || key.includes(bossKey))) return data.kills;
    }

    return null;
}
function gp(v) {
    if (v >= 1e9) return (v/1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v/1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v/1e3).toFixed(0) + 'K';
    return v.toLocaleString();
}
function metric(s) { return s.replace(/_/g, ' '); }

function displayCatName(name) {
    if (name === 'All Pets') return 'Skilling Pets';
    return name;
}

async function getPlayer() { const r=await fetch(`${API}/players/${currentPlayer.toLowerCase().replace(/\s+/g,'%20')}`); if(!r.ok) throw new Error(); return r.json(); }
async function getAchievements() { const r=await fetch(`${API}/players/${currentPlayer.toLowerCase().replace(/\s+/g,'%20')}/achievements`); if(!r.ok) throw new Error(); return r.json(); }
async function getClog() {
    const filename=`collection_log_${currentPlayer.toLowerCase().replace(/\s+/g,'_')}.json`;
    const r=await fetch(filename);
    if(!r.ok) return null;
    return r.json();
}

function renderSummary(p) {
    const s = p.latestSnapshot?.data?.skills?.overall;
    document.getElementById('header-meta').textContent = `${p.type} · Combat ${p.combatLevel||'?'}`;
    document.getElementById('player-summary').innerHTML = `<div class="stats-row">
        <div class="stat-box"><div class="val">${s?fmt(s.level):'—'}</div><div class="lbl">Total</div></div>
        <div class="stat-box"><div class="val">${s?fmt(s.experience):'—'}</div><div class="lbl">XP</div></div>
        <div class="stat-box"><div class="val">${p.ehp?p.ehp.toFixed(1):'—'}</div><div class="lbl">EHP</div></div>
        <div class="stat-box"><div class="val">${p.ehb?p.ehb.toFixed(1):'—'}</div><div class="lbl">EHB</div></div>
        <div class="stat-box"><div class="val">${p.combatLevel||'—'}</div><div class="lbl">Combat</div></div>
        <div class="stat-box"><div class="val">#${s?fmt(s.rank):'—'}</div><div class="lbl">Rank</div></div>
    </div>`;
}

function renderSkills(snap) {
    const el=document.getElementById('skills-tab');
    const sk=snap?.skills;
    if(!sk){el.innerHTML='<p class="empty-msg">No data</p>';return;}
    const arr=Object.entries(sk).filter(([n])=>n!=='overall');
    el.innerHTML=`<div class="skills-grid">${arr.map(([n,d])=>`<div class="skill-row">
        <span class="skill-name">${n}</span>
        <span><span class="skill-xp">${fmt(d.experience)}</span><span class="skill-lvl">${d.level}</span></span>
    </div>`).join('')}</div>`;
}

function renderBosses(snap) {
    const el=document.getElementById('bosses-tab');
    const b=snap?.bosses;
    if(!b){el.innerHTML='<p class="empty-msg">No data</p>';return;}
    const arr=Object.entries(b).filter(([,d])=>d.kills>0).sort((a,b)=>b[1].kills-a[1].kills);
    if(!arr.length){el.innerHTML='<p class="empty-msg">No kills recorded</p>';return;}
    el.innerHTML=`<div class="grid-list">${arr.map(([n,d])=>`<div class="grid-item">
        <span class="grid-item-name">${metric(n)}</span>
        <span class="grid-item-val kills">${fmt(d.kills)}</span>
    </div>`).join('')}</div>`;
}

function renderActivities(snap) {
    const el=document.getElementById('activities-tab');
    const a=snap?.activities;
    if(!a){el.innerHTML='<p class="empty-msg">No data</p>';return;}
    const arr=Object.entries(a).filter(([,d])=>d.score>0).sort((a,b)=>b[1].score-a[1].score);
    if(!arr.length){el.innerHTML='<p class="empty-msg">No scores</p>';return;}
    el.innerHTML=`<div class="grid-list">${arr.map(([n,d])=>`<div class="grid-item">
        <span class="grid-item-name">${metric(n)}</span>
        <span class="grid-item-val score">${fmt(d.score)}</span>
    </div>`).join('')}</div>`;
}

function renderAchievements(achs) {
    const el=document.getElementById('achievements-tab');
    if(!achs?.length){el.innerHTML='<p class="empty-msg">None yet</p>';return;}
    const sorted=[...achs].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    el.innerHTML=`<div class="ach-list">${sorted.map(a=>`<div class="ach-item">
        <div class="ach-name">${a.name}</div>
        <div class="ach-meta">${metric(a.metric)} · ${new Date(a.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
    </div>`).join('')}</div>`;
}

function renderClog(data) {
    const el=document.getElementById('loot-tab');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if(!data){
        el.innerHTML = isLocal ? `
            <div class="clog-header">
                <div class="clog-subtitle">No data yet for ${currentPlayer}.</div>
                <div class="refresh-area">
                    <button class="refresh-btn" id="refresh-btn" onclick="doRefresh()">Refresh</button>
                </div>
            </div>
        ` : '<p class="empty-msg">No data available.</p>';
        return;
    }

    const obtained=[...(data.obtained||[]),...(data.obtainedNoDate||[])];
    const missing=data.missing||[];
    const categories=data.categories||[];
    const total=data.totalClogItems;
    const val=obtained.reduce((s,i)=>s+(i.price*(i.quantity||1)),0);
    const pct=((obtained.length/total)*100).toFixed(1);

    el.innerHTML=`
        <div class="clog-header">
            <div>
                <div class="clog-title">${obtained.length} / ${total}</div>
                <div class="clog-subtitle">${pct}% complete · ${gp(val)} gp value</div>
                <div class="clog-progress"><div class="clog-progress-fill" style="width:${pct}%"></div></div>
            </div>
            ${isLocal ? `<div class="refresh-area">
                <button class="refresh-btn" id="refresh-btn" onclick="doRefresh()">Refresh</button>
                <div class="refresh-meta" id="refresh-meta">${data.generatedAt?new Date(data.generatedAt).toLocaleString():'Never'}</div>
            </div>` : `<div class="refresh-meta">Updated: ${data.generatedAt?new Date(data.generatedAt).toLocaleString():'—'}</div>`}
        </div>
        <div class="clog-view-toggle">
            <button class="clog-view-btn active" id="view-list-btn" onclick="setClogView('list')">All Items</button>
            <button class="clog-view-btn" id="view-cat-btn" onclick="setClogView('categories')">By Boss / Source</button>
        </div>
        <div id="clog-view-list">
            <div class="clog-controls">
                <input type="text" id="clog-search" placeholder="Search items..." />
                <select id="clog-filter">
                    <option value="obtained">Obtained (${obtained.length})</option>
                    <option value="missing">Missing (${missing.length})</option>
                </select>
                <select id="clog-sort">
                    <option value="price">Value</option>
                    <option value="name">Name</option>
                    <option value="tab">Category</option>
                </select>
            </div>
            <div class="clog-list" id="clog-list"></div>
        </div>
        <div id="clog-view-categories" class="hidden">
            <div class="clog-controls">
                <input type="text" id="cat-search" placeholder="Search bosses or items..." />
            </div>
            <div id="cat-item-results" class="hidden"></div>
            <div class="cat-grid" id="cat-grid"></div>
            <div class="cat-detail hidden" id="cat-detail"></div>
        </div>
    `;

    // --- List view ---
    function renderList() {
        const q=document.getElementById('clog-search').value.toLowerCase();
        const f=document.getElementById('clog-filter').value;
        const s=document.getElementById('clog-sort').value;
        let items=f==='obtained'?[...obtained]:[...missing];
        if(q) items=items.filter(i=>{
            const src=i.sources?i.sources.map(x=>x.name.toLowerCase()).join(' '):'';
            return i.name.toLowerCase().includes(q)||i.tab.toLowerCase().includes(q)||src.includes(q);
        });
        if(s==='price') items.sort((a,b)=>b.price-a.price);
        else if(s==='name') items.sort((a,b)=>a.name.localeCompare(b.name));
        else items.sort((a,b)=>a.tab.localeCompare(b.tab)||b.price-a.price);

        const miss=f==='missing';
        document.getElementById('clog-list').innerHTML=items.length?items.map(i=>{
            const src=i.sources?i.sources.map(x=>x.name).filter((v,idx,a)=>a.indexOf(v)===idx).join(', '):'';
            return `<div class="clog-item${miss?' missing':''}">
                <div class="clog-icon"><img src="https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${i.itemId}" alt="" onerror="this.style.display='none'"/></div>
                <div class="clog-info"><div class="clog-name">${i.name}</div><div class="clog-source">${src?src+' · ':''}${i.tab}</div></div>
                <div><div class="clog-price">${i.price>0?gp(i.price):'—'}</div>${i.quantity>1?`<div class="clog-qty">x${fmt(i.quantity)}</div>`:''}</div>
            </div>`;
        }).join(''):'<div class="empty-msg">No results</div>';
    }

    document.getElementById('clog-search').addEventListener('input',renderList);
    document.getElementById('clog-filter').addEventListener('change',renderList);
    document.getElementById('clog-sort').addEventListener('change',renderList);
    renderList();

    // --- Category view ---
    function renderCategories() {
        const q=document.getElementById('cat-search').value.toLowerCase();
        const resultsEl = document.getElementById('cat-item-results');
        const gridEl = document.getElementById('cat-grid');

        // If searching, also search items within categories
        if (q && q.length >= 2) {
            const allCatItems = categories.flatMap(c => c.items.map(i => ({...i, category: c.name})));
            const matchingItems = allCatItems.filter(i => i.name.toLowerCase().includes(q));
            if (matchingItems.length > 0 && !categories.some(c => c.name.toLowerCase().includes(q))) {
                // Show item results
                resultsEl.classList.remove('hidden');
                resultsEl.innerHTML = `<div class="clog-list" style="margin-bottom:12px">${matchingItems.slice(0, 30).map(i => {
                    const isObtained = i.quantity !== undefined || (i.sources && i.sources[0]?.type !== undefined);
                    const src = i.sources ? i.sources.map(x=>x.name).filter((v,idx,a)=>a.indexOf(v)===idx).join(', ') : '';
                    return `<div class="clog-item${!isObtained?' missing':''}">
                        <div class="clog-icon"><img src="https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${i.itemId}" alt="" onerror="this.style.display='none'"/></div>
                        <div class="clog-info"><div class="clog-name">${i.name}</div><div class="clog-source">${src ? src + ' · ' : ''}${displayCatName(i.category)}</div></div>
                        <div><div class="clog-price">${i.price>0?gp(i.price):'—'}</div></div>
                    </div>`;
                }).join('')}${matchingItems.length > 30 ? '<div class="empty-msg">...and ' + (matchingItems.length - 30) + ' more</div>' : ''}</div>`;
            } else {
                resultsEl.classList.add('hidden');
                resultsEl.innerHTML = '';
            }
        } else {
            resultsEl.classList.add('hidden');
            resultsEl.innerHTML = '';
        }

        let cats=categories;
        if(q) cats=cats.filter(c=>c.name.toLowerCase().includes(q));

        gridEl.innerHTML=cats.map(c=>{
            const cpct=c.total>0?Math.round((c.obtained/c.total)*100):0;
            const complete=c.obtained===c.total;
            return `<div class="cat-card${complete?' complete':''}" onclick="showCategory('${c.name.replace(/'/g,"\\'")}')">
                <div class="cat-card-name">${displayCatName(c.name)}</div>
                <div class="cat-card-count">${c.obtained}/${c.total}</div>
                <div class="cat-card-bar"><div class="cat-card-bar-fill" style="width:${cpct}%"></div></div>
            </div>`;
        }).join('');
    }

    document.getElementById('cat-search').addEventListener('input',renderCategories);
    renderCategories();

    // --- Category detail ---
    window.showCategory = function(name) {
        const cat = categories.find(c=>c.name===name);
        if(!cat) return;
        document.getElementById('cat-grid').classList.add('hidden');
        const detail = document.getElementById('cat-detail');
        detail.classList.remove('hidden');

        const kc = getKcForCategory(name, currentPlayerWom);
        const kcStr = kc ? ` · ${fmt(kc)} kc` : '';

        detail.innerHTML=`
            <div class="cat-detail-header">
                <button class="cat-back-btn" onclick="hideCategory()">← Back</button>
                <div class="cat-detail-title">${displayCatName(cat.name)}</div>
                <div class="cat-detail-count">${cat.obtained} / ${cat.total}${kcStr}</div>
            </div>
            <div class="clog-list">${[...cat.items].sort((a,b)=>{
                const aObt = a.quantity!==undefined || (a.sources && a.sources[0]?.type!==undefined);
                const bObt = b.quantity!==undefined || (b.sources && b.sources[0]?.type!==undefined);
                if(aObt && !bObt) return 1;
                if(!aObt && bObt) return -1;
                return a.name.localeCompare(b.name);
            }).map(i=>{
                const isObtained = i.quantity!==undefined || (i.sources && i.sources[0]?.type!==undefined);
                const src=i.sources?i.sources.map(x=>x.name).filter((v,idx,a)=>a.indexOf(v)===idx).join(', '):'';
                return `<div class="clog-item${!isObtained?' missing':''}">
                    <div class="clog-icon"><img src="https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${i.itemId}" alt="" onerror="this.style.display='none'"/></div>
                    <div class="clog-info"><div class="clog-name">${i.name}</div>${src?`<div class="clog-source">${src}</div>`:''}</div>
                    <div><div class="clog-price">${i.price>0?gp(i.price):'—'}</div>${i.quantity>1?`<div class="clog-qty">x${fmt(i.quantity)}</div>`:''}</div>
                </div>`;
            }).join('')}</div>
        `;
    };

    window.hideCategory = function() {
        document.getElementById('cat-grid').classList.remove('hidden');
        document.getElementById('cat-detail').classList.add('hidden');
    };

    // --- View toggle ---
    window.setClogView = function(view) {
        document.getElementById('view-list-btn').classList.toggle('active', view==='list');
        document.getElementById('view-cat-btn').classList.toggle('active', view==='categories');
        document.getElementById('clog-view-list').classList.toggle('hidden', view!=='list');
        document.getElementById('clog-view-categories').classList.toggle('hidden', view!=='categories');
        if(view==='categories') { hideCategory(); renderCategories(); }
    };
}

async function renderGroup() {
    const bossesEl = document.getElementById('group-bosses-tab');
    const clogEl = document.getElementById('group-clog-tab');

    // Load both players' clog data
    const [dryData, salisaData] = await Promise.all([
        fetch('collection_log_drykeys.json').then(r=>r.ok?r.json():null).catch(()=>null),
        fetch('collection_log_salisa_taka.json').then(r=>r.ok?r.json():null).catch(()=>null)
    ]);

    // Load both players' WOM data for boss kills
    const [dryWom, salisaWom] = await Promise.all([
        fetch(`${API}/players/drykeys`).then(r=>r.ok?r.json():null).catch(()=>null),
        fetch(`${API}/players/salisa%20taka`).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);

    // --- Merged Boss Kills ---
    const bossKills = {};
    function addBossKills(wom, playerName) {
        if (!wom?.latestSnapshot?.data?.bosses) return;
        for (const [name, data] of Object.entries(wom.latestSnapshot.data.bosses)) {
            if (data.kills <= 0) continue;
            if (!bossKills[name]) bossKills[name] = { total: 0, players: {} };
            bossKills[name].total += data.kills;
            bossKills[name].players[playerName] = data.kills;
        }
    }
    addBossKills(dryWom, 'DryKeys');
    addBossKills(salisaWom, 'Salisa Taka');

    const sortedBosses = Object.entries(bossKills).sort((a,b) => b[1].total - a[1].total);

    bossesEl.innerHTML = `<div class="grid-list">${sortedBosses.map(([name, data]) => {
        const breakdown = Object.entries(data.players).map(([p,k])=>`${p}: ${fmt(k)}`).join(' · ');
        return `<div class="grid-item">
            <div><div class="grid-item-name">${metric(name)}</div><div class="clog-source">${breakdown}</div></div>
            <span class="grid-item-val kills">${fmt(data.total)}</span>
        </div>`;
    }).join('')}</div>`;

    // --- Merged Collection Log ---
    if (!dryData && !salisaData) {
        clogEl.innerHTML = '<p class="empty-msg">No collection log data. Refresh both players first.</p>';
        return;
    }

    const wikiItems = JSON.parse(await fetch('clog_items_wiki.json').then(r=>r.text()));
    const clogItemsById = new Map();
    for (const key of Object.keys(wikiItems)) {
        const entry = wikiItems[key];
        if (entry && entry.id && entry.name) clogItemsById.set(entry.id, { name: entry.name, tabs: entry.tabs || [] });
    }

    const dryObtainedSet = new Set();
    const salisaObtainedSet = new Set();
    if (dryData) {
        [...(dryData.obtained||[]), ...(dryData.obtainedNoDate||[])].forEach(i => dryObtainedSet.add(i.itemId));
    }
    if (salisaData) {
        [...(salisaData.obtained||[]), ...(salisaData.obtainedNoDate||[])].forEach(i => salisaObtainedSet.add(i.itemId));
    }

    const mergedCategories = {};
    for (const [itemId, info] of clogItemsById.entries()) {
        const cat = info.tabs[0] || 'Unknown';
        if (!mergedCategories[cat]) mergedCategories[cat] = { name: cat, obtained: 0, total: 0, items: [] };
        mergedCategories[cat].total++;

        const dryHas = dryObtainedSet.has(itemId);
        const salisaHas = salisaObtainedSet.has(itemId);
        const owners = [];
        if (dryHas) owners.push('DryKeys');
        if (salisaHas) owners.push('Salisa Taka');

        if (owners.length > 0) mergedCategories[cat].obtained++;
        mergedCategories[cat].items.push({ itemId, name: info.name, tab: cat, owners, obtained: owners.length > 0 });
    }

    const sortedCats = Object.values(mergedCategories).sort((a,b) => a.name.localeCompare(b.name));
    const totalObtained = sortedCats.reduce((s,c) => s + c.obtained, 0);
    const totalItems = sortedCats.reduce((s,c) => s + c.total, 0);
    const pct = ((totalObtained/totalItems)*100).toFixed(1);

    clogEl.innerHTML = `
        <div class="clog-header">
            <div>
                <div class="clog-title">${totalObtained} / ${totalItems}</div>
                <div class="clog-subtitle">${pct}% combined completion</div>
                <div class="clog-progress"><div class="clog-progress-fill" style="width:${pct}%"></div></div>
            </div>
        </div>
        <div class="clog-controls">
            <input type="text" id="grp-cat-search" placeholder="Search bosses or items..." />
        </div>
        <div id="grp-search-results" class="hidden"></div>
        <div class="cat-grid" id="grp-cat-grid"></div>
        <div class="cat-detail hidden" id="grp-cat-detail"></div>
    `;

    function renderGrpCats() {
        const q = document.getElementById('grp-cat-search').value.toLowerCase();
        const resultsEl = document.getElementById('grp-search-results');
        const gridEl = document.getElementById('grp-cat-grid');

        // Search items too
        if (q && q.length >= 2) {
            const allItems = sortedCats.flatMap(c => c.items.map(i => ({...i, category: c.name})));
            const matchingItems = allItems.filter(i => i.name.toLowerCase().includes(q));
            if (matchingItems.length > 0 && !sortedCats.some(c => c.name.toLowerCase().includes(q))) {
                resultsEl.classList.remove('hidden');
                resultsEl.innerHTML = `<div class="clog-list" style="margin-bottom:12px">${matchingItems.slice(0, 30).map(i => {
                    const ownerStr = i.owners.length ? i.owners.join(', ') : '';
                    return `<div class="clog-item${!i.obtained?' missing':''}">
                        <div class="clog-icon"><img src="https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${i.itemId}" alt="" onerror="this.style.display='none'"/></div>
                        <div class="clog-info"><div class="clog-name">${i.name}</div><div class="clog-source">${ownerStr ? ownerStr + ' · ' : ''}${displayCatName(i.category)}</div></div>
                    </div>`;
                }).join('')}${matchingItems.length > 30 ? '<div class="empty-msg">...and ' + (matchingItems.length - 30) + ' more</div>' : ''}</div>`;
            } else {
                resultsEl.classList.add('hidden');
                resultsEl.innerHTML = '';
            }
        } else {
            resultsEl.classList.add('hidden');
            resultsEl.innerHTML = '';
        }

        let cats = sortedCats;
        if (q) cats = cats.filter(c => c.name.toLowerCase().includes(q));
        gridEl.innerHTML = cats.map(c => {
            const cpct = c.total > 0 ? Math.round((c.obtained/c.total)*100) : 0;
            return `<div class="cat-card${c.obtained===c.total?' complete':''}" onclick="showGrpCategory('${c.name.replace(/'/g,"\\'")}')">
                <div class="cat-card-name">${displayCatName(c.name)}</div>
                <div class="cat-card-count">${c.obtained}/${c.total}</div>
                <div class="cat-card-bar"><div class="cat-card-bar-fill" style="width:${cpct}%"></div></div>
            </div>`;
        }).join('');
    }
    document.getElementById('grp-cat-search').addEventListener('input', renderGrpCats);
    renderGrpCats();

    window.showGrpCategory = function(name) {
        const cat = sortedCats.find(c => c.name === name);
        if (!cat) return;
        document.getElementById('grp-cat-grid').classList.add('hidden');
        const detail = document.getElementById('grp-cat-detail');
        detail.classList.remove('hidden');

        const dryKc = getKcForCategory(name, dryWom);
        const salisaKc = getKcForCategory(name, salisaWom);
        const totalKc = (dryKc||0) + (salisaKc||0);
        let kcStr = '';
        if (totalKc > 0) {
            const parts = [];
            if (dryKc) parts.push(`DryKeys: ${fmt(dryKc)}`);
            if (salisaKc) parts.push(`Salisa Taka: ${fmt(salisaKc)}`);
            kcStr = ` · ${fmt(totalKc)} kc (${parts.join(', ')})`;
        }

        const sorted = [...cat.items].sort((a,b) => {
            if (a.obtained && !b.obtained) return 1;
            if (!a.obtained && b.obtained) return -1;
            return a.name.localeCompare(b.name);
        });

        detail.innerHTML = `
            <div class="cat-detail-header">
                <button class="cat-back-btn" onclick="hideGrpCategory()">← Back</button>
                <div class="cat-detail-title">${displayCatName(cat.name)}</div>
                <div class="cat-detail-count">${cat.obtained} / ${cat.total}${kcStr}</div>
            </div>
            <div class="clog-list">${sorted.map(i => {
                const ownerStr = i.owners.length ? i.owners.join(', ') : '';
                return `<div class="clog-item${!i.obtained?' missing':''}">
                    <div class="clog-icon"><img src="https://secure.runescape.com/m=itemdb_oldschool/obj_big.gif?id=${i.itemId}" alt="" onerror="this.style.display='none'"/></div>
                    <div class="clog-info">
                        <div class="clog-name">${i.name}</div>
                        ${ownerStr ? `<div class="clog-source">${ownerStr}</div>` : ''}
                    </div>
                </div>`;
            }).join('')}</div>
        `;
    };

    window.hideGrpCategory = function() {
        document.getElementById('grp-cat-grid').classList.remove('hidden');
        document.getElementById('grp-cat-detail').classList.add('hidden');
    };
}

function setupTabs() {
    const tabs=document.querySelectorAll('.tab');
    tabs.forEach(t=>t.addEventListener('click',()=>{
        tabs.forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));
        document.getElementById(t.dataset.tab+'-tab').classList.remove('hidden');
    }));
}

async function doRefresh() {
    const btn=document.getElementById('refresh-btn');
    btn.disabled=true; btn.textContent='...';
    try {
        const r=await fetch(`/api/refresh-clog?player=${encodeURIComponent(currentPlayer)}`,{method:'POST'});
        const j=await r.json();
        if(j.success){btn.textContent='Done';setTimeout(()=>location.reload(),600);}
        else{btn.textContent='Error';setTimeout(()=>{btn.textContent='Refresh';btn.disabled=false;},2000);}
    } catch{btn.textContent='Error';setTimeout(()=>{btn.textContent='Refresh';btn.disabled=false;},2000);}
}
window.doRefresh=doRefresh;

function switchPlayer(name) {
    if (name === 'Group') {
        document.querySelectorAll('.player-btn').forEach(b => b.classList.toggle('active', b.dataset.player === 'Group'));
        document.getElementById('player-title').textContent = 'Group';
        document.getElementById('header-meta').textContent = 'DryKeys + Salisa Taka';
        // Swap tab bar to group tabs
        document.getElementById('tab-bar').innerHTML = `
            <button class="tab active" data-tab="group-bosses">Bosses</button>
            <button class="tab" data-tab="group-clog">Collection Log</button>
        `;
        // Hide all content, show group bosses
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('group-bosses-tab').classList.remove('hidden');
        // Hide player summary
        document.getElementById('player-summary').classList.add('hidden');
        setupTabs();
        renderGroup();
        return;
    }
    currentPlayer = name;
    document.querySelectorAll('.player-btn').forEach(b => b.classList.toggle('active', b.dataset.player === name));
    document.getElementById('player-title').textContent = name;
    // Restore normal tab bar
    document.getElementById('tab-bar').innerHTML = `
        <button class="tab active" data-tab="skills">Skills</button>
        <button class="tab" data-tab="bosses">Bosses</button>
        <button class="tab" data-tab="loot">Collection Log</button>
        <button class="tab" data-tab="activities">Activities</button>
        <button class="tab" data-tab="achievements">Achievements</button>
    `;
    document.getElementById('player-summary').classList.remove('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');
    init();
}
window.switchPlayer = switchPlayer;

async function init() {
    try {
        const [player,achs,clog]=await Promise.all([getPlayer(),getAchievements(),getClog()]);
        currentPlayerWom = player;
        renderSummary(player);
        renderSkills(player.latestSnapshot?.data);
        renderBosses(player.latestSnapshot?.data);
        renderActivities(player.latestSnapshot?.data);
        renderAchievements(achs);
        renderClog(clog);
        setupTabs();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
    } catch(e) {
        console.error(e);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
    }
}
init();
