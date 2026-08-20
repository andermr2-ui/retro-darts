let players = [];
let colorIndex = 0;
let legNumber = 1;
let legWins = {}; // playerId -> mangas ganadas en la partida en curso
let winnerPlayerId = null;
let currentMatchId = null; // agrupa las mangas de la partida en curso para el gráfico
const TARGET_SCORE = 420;

let addPlayerMode = 'guest';

const playersContainer = document.getElementById('players-container');
const inputNewPlayer = document.getElementById('new-player-name');
const btnAddPlayer = document.getElementById('btn-add-player');
const guestAddRow = document.getElementById('guest-add-row');
const btnModeGuest = document.getElementById('btn-mode-guest');
const btnModeLibrary = document.getElementById('btn-mode-library');
const libraryPickerWrap = document.getElementById('library-picker-wrap');
const libraryPicker = document.getElementById('library-picker');
const libraryEmptyHint = document.getElementById('library-empty-hint');
const roundIndicator = document.getElementById('round-indicator');
const winnerModal = document.getElementById('winner-modal');
const winnerText = document.getElementById('winner-text');
const btnNextRound = document.getElementById('btn-next-round');
const btnReset = document.getElementById('btn-reset');

const btnOpenProfiles = document.getElementById('btn-open-profiles');
const btnCloseProfiles = document.getElementById('btn-close-profiles');
const profilesModal = document.getElementById('profiles-modal');
const profilesList = document.getElementById('profiles-list');
const newProfileName = document.getElementById('new-profile-name');
const newProfileSkin = document.getElementById('new-profile-skin');
const btnAddProfile = document.getElementById('btn-add-profile');

const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');

const btnAdvanceTurn = document.getElementById('btn-advance-turn');

const btnOpenGraph = document.getElementById('btn-open-graph');
const btnCloseGraph = document.getElementById('btn-close-graph');
const graphModal = document.getElementById('graph-modal');
const scoreCanvas = document.getElementById('score-canvas');
const graphLegend = document.getElementById('graph-legend');

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function init() {
    Store.load();
    renderSkinOptions();
    renderLibraryPicker();

    const saved = Store.data.currentMatch;
    if (saved && Array.isArray(saved.players) && saved.players.length) {
        players = saved.players.map(p => ({
            id: p.id,
            name: p.name,
            skin: skinById(p.skin),
            score: p.score,
            history: p.history,
            profileId: p.profileId || null,
            locked: p.locked || false,
            pendingThrow: p.pendingThrow ?? null,
        }));
        legNumber = saved.legNumber || 1;
        legWins = saved.legWins || {};
        currentMatchId = saved.matchId || uid();
        colorIndex = players.length;
    } else {
        currentMatchId = uid();
    }

    setupEventListeners();
    updateRoundIndicator();
    renderPlayers();
}

function setupEventListeners() {
    btnAddPlayer.addEventListener('click', handleAddPlayerClick);

    inputNewPlayer.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && inputNewPlayer.value.trim()) {
            addPlayer(inputNewPlayer.value, null);
            inputNewPlayer.value = '';
        }
    });

    btnNextRound.addEventListener('click', nextRound);
    btnReset.addEventListener('click', resetMatch);

    btnOpenProfiles.addEventListener('click', openProfilesModal);
    btnCloseProfiles.addEventListener('click', () => profilesModal.classList.add('hidden'));
    btnAddProfile.addEventListener('click', handleAddProfile);

    btnOpenHistory.addEventListener('click', openHistoryModal);
    btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));

    btnOpenGraph.addEventListener('click', openGraphModal);
    btnCloseGraph.addEventListener('click', () => graphModal.classList.add('hidden'));

    btnAdvanceTurn.addEventListener('click', advanceTurn);

    btnModeGuest.addEventListener('click', () => setAddPlayerMode('guest'));
    btnModeLibrary.addEventListener('click', () => setAddPlayerMode('library'));
}

function setAddPlayerMode(mode) {
    addPlayerMode = mode;
    btnModeGuest.classList.toggle('active', mode === 'guest');
    btnModeLibrary.classList.toggle('active', mode === 'library');
    guestAddRow.classList.toggle('hidden', mode !== 'guest');
    libraryPickerWrap.classList.toggle('hidden', mode !== 'library');
    libraryEmptyHint.classList.toggle('hidden', !(mode === 'library' && !Store.data.profiles.length));
}

function handleAddPlayerClick() {
    if (inputNewPlayer.value.trim()) {
        addPlayer(inputNewPlayer.value, null);
        inputNewPlayer.value = '';
    }
}

/** Añadir un jugador nuevo (por nombre) lo crea directo como perfil en la
    biblioteca — así queda disponible la próxima vez sin tener que pasar por
    el modal de PERFILES aparte. Si el nombre ya existe como perfil, se
    reutiliza ese perfil en vez de duplicarlo. */
function addPlayer(name, profileId) {
    let finalName;
    let skin;
    let linkedProfileId = profileId || null;

    if (profileId) {
        if (players.some(p => p.profileId === profileId)) return; // ya está en juego
        const profile = Store.profile(profileId);
        if (!profile) return;
        finalName = profile.name;
        skin = skinById(profile.skin);
    } else {
        finalName = name.toUpperCase();
        skin = SKINS[colorIndex % SKINS.length];
        colorIndex++;

        const result = Store.addProfile(finalName, skin.id);
        if (result) {
            const profile = result.profile || result.dupe;
            if (players.some(p => p.profileId === profile.id)) return; // ya está en juego
            linkedProfileId = profile.id;
            finalName = profile.name;
            skin = skinById(profile.skin);
        }
    }

    players.push({
        id: uid(),
        name: finalName,
        skin,
        score: 0,
        history: [],
        profileId: linkedProfileId,
        locked: false,
        pendingThrow: null,
    });
    persistCurrentMatch();
    renderPlayers();
}

function removePlayer(playerId) {
    const confirmDelete = confirm("¿Seguro que querés eliminar a este jugador?");
    if (confirmDelete) {
        players = players.filter(p => p.id !== playerId);
        delete legWins[playerId];
        persistCurrentMatch();
        renderPlayers();
    }
}

function handleScore(playerId, points) {
    if (isNaN(points) || points < 0) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const previousScore = player.score;
    let newScore = previousScore + points;
    let bust = false;
    let sobrante = 0;

    if (newScore > TARGET_SCORE) {
        bust = true;
        sobrante = newScore - TARGET_SCORE;
        newScore = TARGET_SCORE - sobrante;
    }

    player.score = newScore;
    player.history.unshift({
        throw: points,
        result: newScore,
        bust: bust,
        sobrante: sobrante
    });

    persistCurrentMatch();
    renderPlayers();

    if (newScore === TARGET_SCORE) {
        showWinner(player);
    }
}

function undoLast(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player || player.history.length === 0) return;

    player.history.shift();

    let reconstructedScore = 0;
    const historyReversed = [...player.history].reverse();

    for (let record of historyReversed) {
        let tempScore = reconstructedScore + record.throw;
        if (tempScore > TARGET_SCORE) {
            let s = tempScore - TARGET_SCORE;
            tempScore = TARGET_SCORE - s;
        }
        reconstructedScore = tempScore;
    }

    player.score = reconstructedScore;
    persistCurrentMatch();
    renderPlayers();
}

function renamePlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newName = prompt(`Escribí el nuevo nombre para ${player.name}:`, player.name);
    if (newName !== null && newName.trim() !== '') {
        player.name = newName.trim().toUpperCase();
        persistCurrentMatch();
        renderPlayers();
    }
}

function changePlayerColor(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const currentIndex = SKINS.findIndex(s => s.id === player.skin.id);
    player.skin = SKINS[(currentIndex + 1) % SKINS.length];
    if (player.profileId) {
        Store.updateProfile(player.profileId, { skin: player.skin.id });
    }
    persistCurrentMatch();
    renderPlayers();
}

function getSymmetricLayout(n) {
    if (n === 0) return [];
    if (n === 1) return [1];
    if (n === 2) return [2];
    if (n === 3) return [3];
    if (n === 4) return [2, 2];
    if (n === 5) return [3, 2];
    if (n === 6) return [3, 3];
    if (n === 7) return [2, 3, 2];
    if (n === 8) return [4, 4];
    if (n === 9) return [3, 3, 3];
    if (n === 10) return [3, 4, 3];

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    let layout = new Array(rows).fill(Math.floor(n/rows));
    let remainder = n % rows;

    let center = Math.floor(rows / 2);
    let i = 0;
    while(remainder > 0) {
        let offset = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
        if (center + offset >= 0 && center + offset < rows) {
            layout[center + offset]++;
            remainder--;
        }
        i++;
    }
    return layout;
}

function renderPlayers() {
    playersContainer.innerHTML = '';

    if (!players.length) {
        playersContainer.innerHTML = '<p class="empty-hint">Todavía no hay jugadores — añadí uno arriba para empezar.</p>';
        renderLibraryPicker();
        return;
    }

    const layout = getSymmetricLayout(players.length);
    let playerIndex = 0;

    for (let r = 0; r < layout.length; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'player-row';

        for (let c = 0; c < layout[r]; c++) {
            if (playerIndex >= players.length) break;
            const player = players[playerIndex];
            const color = player.skin.primary;
            const wins = legWins[player.id] || 0;

            const card = document.createElement('div');
            card.className = player.locked ? 'player-card locked' : 'player-card';

            let historyHTML = player.history.map(h => {
                if (h.bust) {
                    return `<div class="history-item history-bust">
                        <span>Tiró ${h.throw} (Sobran ${h.sobrante})</span>
                        <span>-> ${h.result}</span>
                    </div>`;
                }
                return `<div class="history-item">
                    <span>Tiró ${h.throw}</span>
                    <span>-> ${h.result}</span>
                </div>`;
            }).join('');

            card.innerHTML = `
                <div class="card-gradient" style="background: linear-gradient(90deg, transparent, ${color}, transparent);"></div>
                <button class="btn-remove" onclick="removePlayer('${player.id}')" title="Quitar Jugador">X</button>
                ${wins > 0 ? `<div class="win-badge" style="border-color:${color}; color:${color};">🏆 ${wins}</div>` : ''}

                <div class="player-name" style="color: ${color}; cursor: pointer; text-decoration: underline; text-decoration-color: ${color}60;" onclick="renamePlayer('${player.id}')" title="Clic para renombrar">
                    ${escapeHTML(player.name)} ✎
                </div>

                <div style="text-align: center; margin-bottom: 2cqmin;">
                    <button onclick="changePlayerColor('${player.id}')" style="background:none; border:1px solid ${color}40; color:${color}; font-family:var(--font-retro); font-size:4cqmin; padding:1cqmin 2cqmin; cursor:pointer; border-radius:1cqmin; transition: 0.2s;" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'">
                        CAMBIAR SKIN
                    </button>
                </div>

                <div class="player-score" style="text-shadow: 0 0 10px #fff, 0 0 20px ${color};">${player.score}</div>

                ${player.locked ? `
                <div class="locked-panel" style="border-color:${color}; color:${color};">
                    <div class="locked-icon">🔒</div>
                    <div class="locked-value">${player.pendingThrow}</div>
                    <button class="retro-btn sm" style="color:${color}; border-color:${color};" onclick="unlockPlayer('${player.id}')">
                        🔓 DESBLOQUEAR
                    </button>
                </div>
                ` : `
                <div class="throw-controls">
                    <input type="number" id="input-${player.id}" class="throw-input" placeholder="PUNTOS" min="0" step="0.5" autocomplete="off" style="border-color:${color}; color:${color}; box-shadow: inset 0 0 10px ${color}20;">
                    <button class="retro-btn sm" style="color:${color}; border-color:${color};" onclick="submitScore('${player.id}')" onmouseover="this.style.background='${color}'; this.style.color='#000';" onmouseout="this.style.background='transparent'; this.style.color='${color}';">
                        OK
                    </button>
                </div>
                `}

                <button class="retro-btn sm yellow btn-undo" onclick="undoLast('${player.id}')">DESHACER</button>

                <div class="history-container">
                    ${historyHTML}
                </div>
            `;
            rowDiv.appendChild(card);

            setTimeout(() => {
                const input = document.getElementById(`input-${player.id}`);
                if (input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            submitScore(player.id);
                        }
                    });
                }
            }, 0);

            playerIndex++;
        }
        playersContainer.appendChild(rowDiv);
    }

    renderLibraryPicker();
}

/** Cierra la ficha del jugador con el tiro tipeado, en vez de aplicarlo ya
    mismo — queda "en espera" hasta que se confirme el turno con
    SIGUIENTE TURNO, para no tener que ir jugador por jugador. */
function lockPlayerThrow(playerId) {
    const input = document.getElementById(`input-${playerId}`);
    const points = parseFloat(input.value);
    if (isNaN(points) || points < 0) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    player.locked = true;
    player.pendingThrow = points;
    persistCurrentMatch();
    renderPlayers();
}

function unlockPlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    player.locked = false;
    player.pendingThrow = null;
    persistCurrentMatch();
    renderPlayers();
}

/** Aplica de una sola vez el tiro de todos los jugadores que ya cerraron su
    ficha y deja sin tocar a quien todavía no tipeó nada este turno. */
function advanceTurn() {
    players.forEach(p => {
        if (p.locked && p.pendingThrow !== null) {
            handleScore(p.id, p.pendingThrow);
        }
    });
    players.forEach(p => {
        p.locked = false;
        p.pendingThrow = null;
    });
    persistCurrentMatch();
    renderPlayers();
}

// Make functions global for inline onclick
window.submitScore = lockPlayerThrow;
window.unlockPlayer = unlockPlayer;
window.undoLast = undoLast;
window.renamePlayer = renamePlayer;
window.changePlayerColor = changePlayerColor;
window.removePlayer = removePlayer;

function showWinner(player) {
    winnerPlayerId = player.id;
    winnerText.textContent = `${player.name} GANA!`;
    winnerModal.classList.remove('hidden');
}

function recordCurrentLeg() {
    const legPlayers = players.map(p => ({
        profileId: p.profileId || null,
        name: p.name,
        finalScore: p.score,
        won: p.id === winnerPlayerId,
        throwCount: p.history.length,
        throws: [...p.history].reverse().map(h => h.throw),
    }));
    Store.recordLeg({ legNumber, target: TARGET_SCORE, players: legPlayers, matchId: currentMatchId });
    if (winnerPlayerId) {
        legWins[winnerPlayerId] = (legWins[winnerPlayerId] || 0) + 1;
    }
}

function clearScores() {
    players.forEach(p => {
        p.score = 0;
        p.history = [];
    });
}

function nextRound() {
    recordCurrentLeg();
    clearScores();
    legNumber++;
    winnerPlayerId = null;
    winnerModal.classList.add('hidden');
    persistCurrentMatch();
    updateRoundIndicator();
    renderPlayers();
}

function resetMatch() {
    recordCurrentLeg();

    const profileWins = {};
    players.forEach(p => {
        if (!p.profileId) return;
        profileWins[p.profileId] = (profileWins[p.profileId] || 0) + (legWins[p.id] || 0);
    });
    Store.finalizeMatch(profileWins);

    clearScores();
    legWins = {};
    legNumber = 1;
    winnerPlayerId = null;
    currentMatchId = uid();
    winnerModal.classList.add('hidden');
    persistCurrentMatch();
    updateRoundIndicator();
    renderPlayers();
}

function updateRoundIndicator() {
    roundIndicator.textContent = `RONDA ${legNumber}`;
}

function persistCurrentMatch() {
    Store.saveCurrentMatch({
        legNumber,
        legWins,
        matchId: currentMatchId,
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            skin: p.skin.id,
            score: p.score,
            history: p.history,
            profileId: p.profileId,
            locked: p.locked,
            pendingThrow: p.pendingThrow,
        })),
    });
}

/* ---- perfiles ---- */

function renderSkinOptions() {
    newProfileSkin.innerHTML = SKINS.map(s =>
        `<option value="${s.id}">${escapeHTML(s.label)}</option>`).join('');
}

function renderLibraryPicker() {
    libraryPicker.innerHTML = Store.data.profiles.map(profile => {
        const skin = skinById(profile.skin);
        const inPlay = players.some(p => p.profileId === profile.id);
        return `
            <button class="player-chip${inPlay ? ' disabled' : ''}" style="border-color:${skin.primary}; color:${skin.primary};" onclick="addPlayerFromLibrary('${profile.id}')" ${inPlay ? 'disabled' : ''}>
                <span class="chip-avatar" style="background:${skin.primary};"></span>
                ${escapeHTML(profile.name)}
            </button>
        `;
    }).join('');
    libraryEmptyHint.classList.toggle('hidden', !(addPlayerMode === 'library' && !Store.data.profiles.length));
}

window.addPlayerFromLibrary = function(profileId) {
    addPlayer(null, profileId);
};

function openProfilesModal() {
    renderProfilesList();
    profilesModal.classList.remove('hidden');
}

function renderProfilesList() {
    if (!Store.data.profiles.length) {
        profilesList.innerHTML = '<p class="empty-hint">Todavía no hay perfiles guardados.</p>';
        return;
    }
    profilesList.innerHTML = Store.data.profiles.map(profile => {
        const skin = skinById(profile.skin);
        const winRate = profile.stats.legsPlayed
            ? Math.round((profile.stats.legsWon / profile.stats.legsPlayed) * 100)
            : 0;
        return `
            <div class="profile-card">
                <div class="profile-header">
                    <div class="profile-swatch" style="background:${skin.primary}; border-color:${skin.accent};"></div>
                    <div class="profile-info">
                        <div class="profile-name">${escapeHTML(profile.name)}</div>
                        <div class="profile-stats">
                            ${profile.stats.legsWon}/${profile.stats.legsPlayed} mangas (${winRate}%) · ${profile.stats.matchesWon} partidas ganadas
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="retro-btn compact" onclick="cycleProfileSkin('${profile.id}')">SKIN</button>
                    <button class="retro-btn compact" onclick="renameProfile('${profile.id}')">RENOMBRAR</button>
                    <button class="retro-btn compact yellow" onclick="deleteProfile('${profile.id}')">BORRAR</button>
                </div>
            </div>
        `;
    }).join('');
}

function handleAddProfile() {
    const name = newProfileName.value;
    const skinId = newProfileSkin.value;
    const result = Store.addProfile(name, skinId);
    if (!result) return;
    if (result.dupe) {
        alert('Ya existe un perfil con ese nombre.');
        return;
    }
    newProfileName.value = '';
    renderProfilesList();
    renderLibraryPicker();
}

window.cycleProfileSkin = function(profileId) {
    const profile = Store.profile(profileId);
    if (!profile) return;
    const currentIndex = SKINS.findIndex(s => s.id === profile.skin);
    const nextSkin = SKINS[(currentIndex + 1) % SKINS.length];
    Store.updateProfile(profileId, { skin: nextSkin.id });
    const inPlay = players.find(p => p.profileId === profileId);
    if (inPlay) {
        inPlay.skin = nextSkin;
        persistCurrentMatch();
        renderPlayers();
    }
    renderProfilesList();
};

window.renameProfile = function(profileId) {
    const profile = Store.profile(profileId);
    if (!profile) return;
    const newName = prompt(`Escribí el nuevo nombre para ${profile.name}:`, profile.name);
    if (newName === null || !newName.trim()) return;
    Store.updateProfile(profileId, { name: newName.trim() });
    renderProfilesList();
    renderLibraryPicker();
};

window.deleteProfile = function(profileId) {
    if (!confirm('¿Seguro que querés borrar este perfil? Se pierden sus estadísticas.')) return;
    Store.removeProfile(profileId);
    players.forEach(p => { if (p.profileId === profileId) p.profileId = null; });
    persistCurrentMatch();
    renderProfilesList();
    renderLibraryPicker();
};

/* ---- historial ---- */

function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove('hidden');
}

function renderHistoryList() {
    if (!Store.data.matchHistory.length) {
        historyList.innerHTML = '<p class="empty-hint">Todavía no hay mangas registradas.</p>';
        return;
    }
    historyList.innerHTML = Store.data.matchHistory.map(leg => {
        const date = new Date(leg.date).toLocaleString();
        const rows = leg.players.map(p =>
            `<div class="history-leg-player ${p.won ? 'history-leg-winner' : ''}">
                <span>${escapeHTML(p.name)}${p.won ? ' 🏆' : ''}</span>
                <span>${p.finalScore}</span>
            </div>`).join('');
        return `
            <div class="history-leg">
                <div class="history-leg-header">
                    <span>Ronda ${leg.legNumber}</span>
                    <span>${date}</span>
                </div>
                ${rows}
            </div>
        `;
    }).join('');
}

/* ---- gráfico de puntuación ----
   Canvas dibujado a mano (sin librería), mismo enfoque que el GraphCanvas de
   niobiologic. Cada RONDA (manga) de la partida en curso es un sector del
   eje X con el mismo ancho, sin importar cuántos tiros tuvo; los puntos son
   aditivos: no se resetean al pasar de ronda, siguen sumando el total
   tirado en toda la partida. */

/** Mangas de la partida en curso, en orden: las ya jugadas (del historial,
    filtradas por matchId) + la ronda actual con los tiros en memoria. */
function getMatchLegsInOrder() {
    const completed = Store.data.matchHistory
        .filter(l => l.matchId === currentMatchId)
        .sort((a, b) => a.legNumber - b.legNumber);
    const current = {
        legNumber,
        players: players.map(p => ({
            profileId: p.profileId || null,
            name: p.name,
            throws: [...p.history].reverse().map(h => h.throw),
        })),
    };
    return [...completed, current];
}

/** Tiros de un jugador en una manga dada, o null si no jugó esa manga. */
function getPlayerThrowsInLeg(leg, player) {
    const entry = leg.players.find(p =>
        player.profileId ? p.profileId === player.profileId : (!p.profileId && p.name === player.name));
    return entry ? entry.throws : null;
}

/** Serie aditiva de un jugador a lo largo de toda la partida: cada manga
    ocupa un sector [i, i+1) del eje X, empezando en el total acumulado
    hasta ese momento y sumando cada tiro dentro del sector. */
function buildPlayerSeries(player, legs) {
    let cumulative = 0;
    const points = [];
    legs.forEach((leg, legIdx) => {
        const throws = getPlayerThrowsInLeg(leg, player);
        if (throws === null) return;
        points.push({ x: legIdx, y: cumulative });
        throws.forEach((t, i) => {
            cumulative += t;
            points.push({ x: legIdx + (i + 1) / throws.length, y: cumulative });
        });
    });
    return points;
}

function openGraphModal() {
    renderGraphLegend();
    graphModal.classList.remove('hidden');
    requestAnimationFrame(drawScoreChart);
}

function renderGraphLegend() {
    if (!players.length) {
        graphLegend.innerHTML = '<p class="empty-hint">No hay jugadores en la partida.</p>';
        return;
    }
    const legs = getMatchLegsInOrder();
    graphLegend.innerHTML = players.map(p => {
        const series = buildPlayerSeries(p, legs);
        const total = series.length ? series[series.length - 1].y : 0;
        return `
        <div class="legend-item">
            <span class="legend-swatch" style="background:${p.skin.primary};"></span>
            <span>${escapeHTML(p.name)} — ${total} pts acumulados (ronda ${legNumber})</span>
        </div>
    `;
    }).join('');
}

function drawScoreChart() {
    const dpr = window.devicePixelRatio || 1;
    const width = scoreCanvas.clientWidth;
    const height = scoreCanvas.clientHeight;
    scoreCanvas.width = width * dpr;
    scoreCanvas.height = height * dpr;

    const ctx = scoreCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 40, left: 64 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const legs = getMatchLegsInOrder();
    const numLegs = Math.max(1, legs.length);
    const series = players.map(p => ({ player: p, points: buildPlayerSeries(p, legs) }));

    const allY = series.flatMap(s => s.points.map(pt => pt.y));
    const rawMax = Math.max(TARGET_SCORE, ...allY, 1);
    const maxY = Math.ceil((rawMax * 1.1) / 50) * 50;

    const xFor = (x) => padding.left + (x / numLegs) * plotW;
    const yFor = (value) => padding.top + plotH - (value / maxY) * plotH;

    // sectores por ronda (fondo alternado + líneas divisorias)
    for (let i = 0; i < numLegs; i++) {
        if (i % 2 === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(xFor(i), padding.top, xFor(i + 1) - xFor(i), plotH);
        }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numLegs; i++) {
        ctx.beginPath();
        ctx.moveTo(xFor(i), padding.top);
        ctx.lineTo(xFor(i), padding.top + plotH);
        ctx.stroke();
    }

    // etiquetas de ronda
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    legs.forEach((leg, i) => {
        ctx.fillText(`RONDA ${leg.legNumber}`, xFor(i + 0.5), padding.top + plotH + 12);
    });

    // gridlines + eje Y
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const value = Math.round((maxY / steps) * i);
        const y = yFor(value);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(String(value), padding.left - 10, y);
    }

    // series por jugador
    series.forEach(({ player, points }) => {
        if (!points.length) return;
        const color = player.skin.primary;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        points.forEach((pt, i) => {
            const x = xFor(pt.x);
            const y = yFor(pt.y);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = color;
        points.forEach(pt => {
            ctx.beginPath();
            ctx.arc(xFor(pt.x), yFor(pt.y), 3, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotW, plotH);
}

// Initialize
init();
