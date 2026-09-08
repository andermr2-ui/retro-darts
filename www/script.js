/** ---- íconos dibujados a mano ----
    PNG en blanco y negro (32x32), procesados a blanco=transparente para
    poder aplicarlos como máscara CSS (ver .icon-mask) — así cada botón los
    sigue coloreando con el color del jugador, sin tener un color horneado
    en el archivo. */
function iconMask(file) {
    const url = `icons/${file}.png`;
    return `<span class="icon-mask" style="-webkit-mask-image:url('${url}'); mask-image:url('${url}');"></span>`;
}

/** Músicos agrupados por instrumento/rol, cargados desde musicians.json
    (fuente editable: retro-darts/retrodarts_musician_list.json). Se usa
    tanto para el fallback de nombre random al añadir un jugador manual,
    como para armar la banda aleatoria al abrir la app (ver formRandomBand). */
let MUSICIAN_ROLES = null;
let ROLE_POOLS = null;
let ALL_MUSICIANS = [];

async function loadMusicianData() {
    const res = await fetch('musicians.json');
    MUSICIAN_ROLES = await res.json();

    /** Roles usados para armar bandas lógicas (ver BAND_TEMPLATES). "viento"
        fusiona metal + madera + cuerda frotada porque son categorías chicas
        y cumplen el mismo papel de instrumento melódico secundario. */
    ROLE_POOLS = {
        vocal: MUSICIAN_ROLES.cantantes_frontmen,
        rap: MUSICIAN_ROLES.raperos,
        guitarra: MUSICIAN_ROLES.guitarras,
        bajo: MUSICIAN_ROLES.bajistas,
        teclado: MUSICIAN_ROLES.teclados_pianos,
        bateria: MUSICIAN_ROLES.percusion_baterias,
        viento: [...MUSICIAN_ROLES.viento_metal, ...MUSICIAN_ROLES.viento_madera, ...MUSICIAN_ROLES.cuerda_frotada],
        dj: MUSICIAN_ROLES.productores_djs,
    };
    ALL_MUSICIANS = Object.values(MUSICIAN_ROLES).flat();
}

/** Etiquetas legibles de cada categoría, usadas en el selector del popup
    "MÚSICO NUEVO" de la biblioteca. */
const ROLE_LABELS = {
    guitarras: 'Guitarra',
    bajistas: 'Bajo',
    cuerda_frotada: 'Cuerda frotada',
    teclados_pianos: 'Teclado / Piano',
    viento_metal: 'Viento (metal)',
    viento_madera: 'Viento (madera)',
    percusion_baterias: 'Batería / Percusión',
    cantantes_frontmen: 'Voz / Frontman',
    raperos: 'Rap',
    productores_djs: 'Productor / DJ',
};

/** Suma un músico (de la biblioteca personalizada guardada) a las
    estructuras en memoria, sin tener que recargar la página. */
function addMusicianToRuntime(name, role) {
    if (!MUSICIAN_ROLES[role]) return;
    MUSICIAN_ROLES[role].push(name);
    if (role === 'viento_metal' || role === 'viento_madera' || role === 'cuerda_frotada') {
        ROLE_POOLS.viento.push(name);
    }
    ALL_MUSICIANS.push(name);
}

function mergeCustomMusicians() {
    Store.data.customMusicians.forEach(m => addMusicianToRuntime(m.name, m.role));
}

/** Limpieza única: antes de este cambio, cualquier nombre (incluidos los de
    la banda aleatoria) generaba un perfil. Saca esos perfiles-músico
    huérfanos, siempre que nunca hayan acumulado partidas jugadas. */
function pruneMusicianProfiles() {
    const before = Store.data.profiles.length;
    Store.data.profiles = Store.data.profiles.filter(p =>
        !(isKnownMusicianName(p.name) && p.stats.legsPlayed === 0 && p.stats.matchesWon === 0));
    if (Store.data.profiles.length !== before) Store.save();
}

/** Un jugador cuyo nombre coincide con alguien de la biblioteca de músicos
    (de fábrica o añadido a mano) no genera un perfil propio — los perfiles
    son solo para nombres personalizados (ver addPlayer). */
function isKnownMusicianName(name) {
    const lower = (name || '').trim().toLowerCase();
    return ALL_MUSICIANS.some(m => m.toLowerCase() === lower);
}

/** Búsqueda de YouTube del repertorio del músico — el jugador elige qué
    tema poner de los resultados, la app solo arma la búsqueda por nombre. */
function buildYoutubeSearchUrl(name) {
    const words = name.trim().split(/\s+/).map(w => encodeURIComponent(w));
    return `https://www.youtube.com/results?search_query=${words.join('+')}`;
}

/** Dentro de la app de escritorio (Tauri), un <a target="_blank"> normal
    navega la MISMA ventana en vez de abrir el navegador del sistema (se
    perdería la partida en curso) — hay que pedírselo explícitamente al
    plugin "opener". En el navegador normal (esta preview incluida) no hace
    falta: window.__TAURI__ no existe y el link se abre solo, como siempre. */
function openExternal(url) {
    if (window.__TAURI__ && window.__TAURI__.opener) {
        window.__TAURI__.opener.open(url);
        return false;
    }
    return true;
}
window.openExternal = openExternal;

/** Variante de openExternal() para disparar la apertura desde código (no
    desde el onclick de un <a>) — la usa el easter egg de los 44 puntos. */
function openExternalUrl(url) {
    if (window.__TAURI__ && window.__TAURI__.opener) {
        window.__TAURI__.opener.open(url);
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

/** Formaciones de banda plausibles por cantidad de integrantes. Cada una es
    una lista de roles (no de personas) — evita absurdos como 3 guitarristas
    o 2 cantantes sin bajista. */
const BAND_TEMPLATES = {
  3: [
    ['vocal', 'guitarra', 'bateria'],
    ['guitarra', 'bajo', 'bateria'],
    ['vocal', 'guitarra', 'bajo'],
    ['vocal', 'teclado', 'bateria'],
    ['rap', 'dj', 'bateria'],
  ],
  4: [
    ['vocal', 'guitarra', 'bajo', 'bateria'],
    ['guitarra', 'guitarra', 'bajo', 'bateria'],
    ['vocal', 'teclado', 'bajo', 'bateria'],
    ['vocal', 'guitarra', 'teclado', 'bateria'],
    ['rap', 'dj', 'bajo', 'bateria'],
  ],
  5: [
    ['vocal', 'guitarra', 'guitarra', 'bajo', 'bateria'],
    ['vocal', 'guitarra', 'bajo', 'bateria', 'teclado'],
    ['vocal', 'guitarra', 'bajo', 'bateria', 'viento'],
    ['vocal', 'guitarra', 'teclado', 'bajo', 'bateria'],
    ['rap', 'dj', 'guitarra', 'bajo', 'bateria'],
  ],
};

const usedNamesInSession = new Set();

function getRandomArtistName() {
    const available = ALL_MUSICIANS.filter(n => !usedNamesInSession.has(n));
    const pool = available.length > 0 ? available : ALL_MUSICIANS;
    const name = pool[Math.floor(Math.random() * pool.length)];
    usedNamesInSession.add(name);
    return name;
}

/** Elige un músico del rol dado, evitando repetir nombres ya usados en esta
    banda/sesión mientras el pool lo permita. */
function pickMusicianForRole(role, excludeNames) {
    const pool = ROLE_POOLS[role].filter(n => !excludeNames.has(n));
    const source = pool.length > 0 ? pool : ROLE_POOLS[role];
    const name = source[Math.floor(Math.random() * source.length)];
    excludeNames.add(name);
    usedNamesInSession.add(name);
    return name;
}

/** Arma una banda aleatoria de 3 a 5 músicos, como si se hubieran conocido
    en una jam y el anfitrión los agrupara por instrumento: elige una
    formación lógica (BAND_TEMPLATES) y completa cada rol con un músico
    random de esa categoría. */
function formRandomBand() {
    const size = 3 + Math.floor(Math.random() * 3); // 3, 4 o 5
    const templates = BAND_TEMPLATES[size];
    const roles = templates[Math.floor(Math.random() * templates.length)];
    const usedInBand = new Set();
    return roles.map(role => pickMusicianForRole(role, usedInBand));
}

let players = [];
let colorIndex = 0;
let winnerPlayerId = null;
let currentMatchId = null;
const TARGET_SCORE = 420;

/** playerId que se está editando desde el popup JUGADOR NUEVO (null = modo
    alta de jugador nuevo). */
let editingPlayerId = null;
/** { type: 'player'|'profile', id } — a quién se le aplica el cambio hecho
    en el popup APARIENCIA. */
let skinTarget = null;
let webcamStream = null;
const AVATAR_SIZE = 160;

const playersContainer = document.getElementById('players-container');
const winnerModal = document.getElementById('winner-modal');
const winnerText = document.getElementById('winner-text');
const btnReset = document.getElementById('btn-reset');

const btnOpenNewPlayer = document.getElementById('btn-open-new-player');
const btnCloseNewPlayer = document.getElementById('btn-close-new-player');
const newPlayerModal = document.getElementById('new-player-modal');
const newPlayerNameInput = document.getElementById('new-player-name');
const btnRandomName = document.getElementById('btn-random-name');
const btnSaveNewPlayer = document.getElementById('btn-save-new-player');

const btnOpenLibrary = document.getElementById('btn-open-library');
const btnCloseLibrary = document.getElementById('btn-close-library');
const libraryModal = document.getElementById('library-modal');
const librarySearchInput = document.getElementById('library-search');
const libraryMusicianList = document.getElementById('library-musician-list');
const btnOpenAddMusician = document.getElementById('btn-open-add-musician');

const btnCloseAddMusician = document.getElementById('btn-close-add-musician');
const addMusicianModal = document.getElementById('add-musician-modal');
const newMusicianNameInput = document.getElementById('new-musician-name');
const newMusicianRoleSelect = document.getElementById('new-musician-role');
const btnSaveMusician = document.getElementById('btn-save-musician');

const btnOpenProfiles = document.getElementById('btn-open-profiles');
const btnCloseProfiles = document.getElementById('btn-close-profiles');
const profilesModal = document.getElementById('profiles-modal');
const profilesList = document.getElementById('profiles-list');

const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');

const btnOpenGraph = document.getElementById('btn-open-graph');
const btnCloseGraph = document.getElementById('btn-close-graph');
const graphModal = document.getElementById('graph-modal');
const scoreCanvas = document.getElementById('score-canvas');
const graphLegend = document.getElementById('graph-legend');

const skinModal = document.getElementById('skin-modal');
const btnCloseSkin = document.getElementById('btn-close-skin');
const skinColorInput = document.getElementById('skin-color-input');
const btnSaveSkinColor = document.getElementById('btn-save-skin-color');
const btnUploadPhoto = document.getElementById('btn-upload-photo');
const skinFileInput = document.getElementById('skin-file-input');
const btnOpenWebcam = document.getElementById('btn-open-webcam');
const btnCloseWebcam = document.getElementById('btn-close-webcam');
const btnCaptureWebcam = document.getElementById('btn-capture-webcam');
const skinWebcamWrap = document.getElementById('skin-webcam-wrap');
const skinWebcamVideo = document.getElementById('skin-webcam-video');
const skinWebcamCanvas = document.getElementById('skin-webcam-canvas');
const skinPhotoPreviewWrap = document.getElementById('skin-photo-preview-wrap');
const skinPhotoPreview = document.getElementById('skin-photo-preview');
const btnClearPhoto = document.getElementById('btn-clear-photo');

const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const btnSaveRename = document.getElementById('btn-save-rename');
const btnCloseRename = document.getElementById('btn-close-rename');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const btnConfirmYes = document.getElementById('btn-confirm-yes');
const btnConfirmNo = document.getElementById('btn-confirm-no');

const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const btnAlertOk = document.getElementById('btn-alert-ok');

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/* ---- confirmar / alertar / renombrar (reemplazan confirm/prompt/alert
   nativos — no son confiables dentro del WebView de Tauri) ---- */

let confirmCallback = null;
function showConfirm(message, onYes) {
    confirmMessage.textContent = message;
    confirmCallback = onYes;
    confirmModal.classList.remove('hidden');
}

let alertCallback = null;
function showAlert(message, onClose) {
    alertMessage.textContent = message;
    alertCallback = onClose || null;
    alertModal.classList.remove('hidden');
}

let renameCallback = null;
function showRename(currentValue, onSave) {
    renameInput.value = currentValue;
    renameCallback = onSave;
    renameModal.classList.remove('hidden');
}

/** Cada partida es única e irrepetible: no se restaura ninguna partida
    guardada al abrir/recargar la página — siempre arranca una banda nueva
    con nombres aleatorios. */
async function init() {
    await loadMusicianData();
    Store.load();
    mergeCustomMusicians();
    pruneMusicianProfiles();
    renderMusicianRoleOptions();

    btnOpenHistory.innerHTML = iconMask('history');
    btnOpenGraph.innerHTML = iconMask('stonks');

    currentMatchId = uid();
    formRandomBand().forEach(name => addPlayer(name, null));

    setupEventListeners();
    renderPlayers();

    // La primera medida puede correr antes de que cargue la tipografía
    // pixelada (Press Start 2P) — al terminar de cargar, se vuelve a medir
    // con la fuente real para no quedar con un tamaño calculado de más.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refitAllScores);
    }
}

function setupEventListeners() {
    window.addEventListener('resize', debouncedRelayout);

    btnReset.addEventListener('click', resetMatch);

    btnOpenNewPlayer.addEventListener('click', () => openNewPlayerModal(null));
    btnCloseNewPlayer.addEventListener('click', closeNewPlayerFlow);
    btnRandomName.addEventListener('click', () => { newPlayerNameInput.value = getRandomArtistName(); });
    btnSaveNewPlayer.addEventListener('click', handleSaveNewPlayer);
    newPlayerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSaveNewPlayer();
    });

    btnOpenLibrary.addEventListener('click', openLibraryModal);
    btnCloseLibrary.addEventListener('click', () => libraryModal.classList.add('hidden'));
    librarySearchInput.addEventListener('input', () => renderLibraryList(librarySearchInput.value));
    libraryMusicianList.addEventListener('click', handleLibraryListClick);
    btnOpenAddMusician.addEventListener('click', openAddMusicianModal);

    btnCloseAddMusician.addEventListener('click', () => addMusicianModal.classList.add('hidden'));
    btnSaveMusician.addEventListener('click', handleSaveMusician);

    btnOpenProfiles.addEventListener('click', openProfilesModal);
    btnCloseProfiles.addEventListener('click', () => profilesModal.classList.add('hidden'));
    profilesList.addEventListener('click', handleProfilesListClick);

    btnOpenHistory.addEventListener('click', openHistoryModal);
    btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));

    btnOpenGraph.addEventListener('click', openGraphModal);
    btnCloseGraph.addEventListener('click', () => graphModal.classList.add('hidden'));

    btnCloseSkin.addEventListener('click', closeSkinModal);
    btnSaveSkinColor.addEventListener('click', handleSaveSkinColor);
    btnUploadPhoto.addEventListener('click', () => skinFileInput.click());
    skinFileInput.addEventListener('change', handlePhotoFileSelected);
    btnOpenWebcam.addEventListener('click', openWebcam);
    btnCloseWebcam.addEventListener('click', closeWebcam);
    btnCaptureWebcam.addEventListener('click', captureWebcamPhoto);
    btnClearPhoto.addEventListener('click', handleClearPhoto);

    btnSaveRename.addEventListener('click', handleSaveRenameClick);
    btnCloseRename.addEventListener('click', () => { renameModal.classList.add('hidden'); renameCallback = null; });
    renameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSaveRenameClick();
    });

    btnConfirmYes.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        const cb = confirmCallback;
        confirmCallback = null;
        if (cb) cb();
    });
    btnConfirmNo.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    });

    btnAlertOk.addEventListener('click', () => {
        alertModal.classList.add('hidden');
        const cb = alertCallback;
        alertCallback = null;
        if (cb) cb();
    });
}

function handleSaveRenameClick() {
    const value = renameInput.value.trim();
    if (!value) return;
    renameModal.classList.add('hidden');
    const cb = renameCallback;
    renameCallback = null;
    if (cb) cb(value);
}

const newPlayerModalTitle = document.getElementById('new-player-modal-title');

/** Sin playerId: modo alta (agrega un jugador nuevo a la partida). Con
    playerId: modo edición (el botón lápiz de una ficha) — cambia el nombre
    del jugador ya en juego, o lo reemplaza por un músico/perfil elegido. */
function openNewPlayerModal(playerId) {
    editingPlayerId = playerId || null;
    const editingPlayer = editingPlayerId ? players.find(p => p.id === editingPlayerId) : null;
    newPlayerModalTitle.textContent = editingPlayer ? 'EDITAR JUGADOR' : 'JUGADOR NUEVO';
    newPlayerNameInput.value = editingPlayer ? editingPlayer.name : '';
    newPlayerModal.classList.remove('hidden');
}

function closeNewPlayerFlow() {
    editingPlayerId = null;
    newPlayerNameInput.value = '';
    newPlayerModal.classList.add('hidden');
    libraryModal.classList.add('hidden');
    profilesModal.classList.add('hidden');
}

function handleSaveNewPlayer() {
    const name = newPlayerNameInput.value.trim() || getRandomArtistName();
    if (editingPlayerId) {
        applyPlayerIdentity(editingPlayerId, name);
    } else {
        addPlayer(name, null);
    }
    closeNewPlayerFlow();
}

/** Cambia la identidad de un jugador ya en juego por un nombre libre. Si el
    nombre es de la biblioteca de músicos, el jugador queda sin perfil (no
    se guarda nada); si es personalizado, se crea o reutiliza su perfil. */
function applyPlayerIdentity(playerId, rawName) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    player.profileId = null;

    if (!isKnownMusicianName(rawName)) {
        const result = Store.addProfile(rawName.toUpperCase(), player.skin.id);
        if (result) {
            const profile = result.profile || result.dupe;
            player.profileId = profile.id;
            player.name = profile.name;
            player.skin = resolveSkin(profile.skin, profile.customColor);
            player.avatar = profile.avatar || null;
        } else {
            player.name = rawName.toUpperCase();
        }
    } else {
        player.name = rawName.toUpperCase();
    }

    persistCurrentMatch();
    renderPlayers();
}

/** Cambia la identidad de un jugador ya en juego por un perfil guardado. */
function applyPlayerIdentityFromProfile(playerId, profileId) {
    const player = players.find(p => p.id === playerId);
    const profile = Store.profile(profileId);
    if (!player || !profile) return;
    if (players.some(p => p.id !== playerId && p.profileId === profileId)) return; // ya está en juego

    player.profileId = profileId;
    player.name = profile.name;
    player.skin = resolveSkin(profile.skin, profile.customColor);
    player.avatar = profile.avatar || null;

    persistCurrentMatch();
    renderPlayers();
}

/** Añadir un jugador nuevo (por nombre libre, o por profileId ya guardado).
    Un nombre de músico de la biblioteca es un jugador de una sola partida:
    no genera perfil. Un nombre que NO está en la biblioteca es personalizado
    y se guarda como perfil (con stats y rango) para poder reusarlo. */
function addPlayer(name, profileId) {
    let finalName;
    let skin;
    let avatar = null;
    let linkedProfileId = profileId || null;

    if (profileId) {
        if (players.some(p => p.profileId === profileId)) return; // ya está en juego
        const profile = Store.profile(profileId);
        if (!profile) return;
        finalName = profile.name;
        skin = resolveSkin(profile.skin, profile.customColor);
        avatar = profile.avatar || null;
    } else {
        finalName = name.toUpperCase();
        skin = SKINS[colorIndex % SKINS.length];
        colorIndex++;

        if (!isKnownMusicianName(name)) {
            const result = Store.addProfile(finalName, skin.id);
            if (result) {
                const profile = result.profile || result.dupe;
                if (players.some(p => p.profileId === profile.id)) return; // ya está en juego
                linkedProfileId = profile.id;
                finalName = profile.name;
                skin = resolveSkin(profile.skin, profile.customColor);
                avatar = profile.avatar || null;
            }
        }
    }

    players.push({
        id: uid(),
        name: finalName,
        skin,
        avatar,
        score: 0,
        history: [],
        profileId: linkedProfileId,
    });
    persistCurrentMatch();
    renderPlayers();
}

function removePlayer(playerId) {
    showConfirm('¿Seguro que querés eliminar a este jugador?', () => {
        players = players.filter(p => p.id !== playerId);
        persistCurrentMatch();
        renderPlayers();
    });
}

/** Easter egg: silbido "fiu fiu" al llegar a 69 puntos exactos —
    archivo de audio provisto por el usuario (www/sounds/fiu-fiu.mp3). */
function playWolfWhistle() {
    try {
        const audio = new Audio('sounds/fiu-fiu.mp3');
        audio.play().catch(() => {
            // Si el navegador bloquea audio (sin interacción previa, etc.), no pasa nada.
        });
    } catch (e) {
        // Idem — no pasa nada si Audio() no está disponible.
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

    if (newScore === 69) {
        playWolfWhistle();
    }

    if (newScore === 44) {
        openExternalUrl('https://www.youtube.com/watch?v=Sx9whwosHo0&list=RDSx9whwosHo0&start_radio=1');
    }

    if (newScore === 99) {
        openExternalUrl('https://www.youtube.com/watch?v=qhw-XlTMB5I&list=RDqhw-XlTMB5I&start_radio=1');
    }

    if (newScore === 66) {
        openExternalUrl('https://www.youtube.com/watch?v=AqhQSfFtOVE&list=RDAqhQSfFtOVE&start_radio=1&pp=ygUIcm91dGUgNjagBwE%3D');
    }

    if (newScore === 7) {
        openExternalUrl('https://www.youtube.com/watch?v=9V-vcXOpG9g&list=RD9V-vcXOpG9g&start_radio=1&pp=ygUINyBwcmluY2WgBwE%3D');
    }

    if (newScore === 1) {
        openExternalUrl('https://www.youtube.com/watch?v=EyF4js4PJGc&list=RDEyF4js4PJGc&start_radio=1&pp=ygUYb25lIG1ldGFsbGljYSByYWRpbyBlZGl0oAcB');
    }

    if (newScore === 2) {
        openExternalUrl('https://www.youtube.com/watch?v=fugRvM6s5fc&list=RDfugRvM6s5fc&start_radio=1&pp=ygUYZG9zIGdhcmRlbmlhcyByYWRpbyBlZGl0oAcB');
    }

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

/** El lápiz de "editar personaje" abre el popup JUGADOR NUEVO en modo
    edición — reemplaza al viejo prompt() nativo (poco confiable en el
    WebView de Tauri). */
function renamePlayer(playerId) {
    openNewPlayerModal(playerId);
}

function changePlayerColor(playerId) {
    openSkinModal({ type: 'player', id: playerId });
}

/** Ajusta el font-size del puntaje para que ocupe el espacio disponible de
    SU ficha en concreto — ni cqmin ni ningún otro truco de CSS puro sabe
    cuánto mide el texto ya renderizado, así que hay que medirlo: prueba
    tamaños por búsqueda binaria hasta encontrar el más grande que entra
    tanto a lo ancho (nunca se corta un "420") como a lo alto (deja lugar
    para la última jugada, debajo). Así el número se ve igual de grande
    tanto si hay 2 jugadores como si hay 10, sin importar la forma de la
    ficha. */
const _fitScoreCanvas = document.createElement('canvas');
const _fitScoreCtx = _fitScoreCanvas.getContext('2d');

function fitScoreText(scoreEl) {
    if (!scoreEl) return;
    const cardMiddle = scoreEl.parentElement;
    // OJO: scoreEl.clientWidth/scrollWidth NO sirven acá — es un bloque a lo
    // ancho completo de la ficha, así que su "ancho" no cambia aunque el
    // texto sea chico o grande (nunca desborda, nunca "scrollea"). Para
    // saber cuánto ocupa el número tal cual se va a ver, hay que medirlo
    // con canvas.measureText en la tipografía real.
    //
    // El alto disponible normalmente se mide del padre (.card-middle), que
    // en escritorio es una caja flex real. En celular .card-middle es
    // display:contents (no genera caja — ver el fix del historial), así
    // que ahí no mide nada y hay que usar la propia caja de scoreEl
    // (align-self:stretch en mobile hace que sea del tamaño exacto de la
    // celda de la grilla, ver .player-score en style.css).
    const maxWidth = scoreEl.clientWidth * 0.94;
    const maxHeight = (cardMiddle.clientHeight > 0 ? cardMiddle.clientHeight : scoreEl.clientHeight) * 0.68;
    if (maxWidth <= 0 || maxHeight <= 0) return;

    const text = scoreEl.textContent;
    const fontFamily = getComputedStyle(scoreEl).fontFamily;

    let lo = 8, hi = 300;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        _fitScoreCtx.font = `${mid}px ${fontFamily}`;
        const width = _fitScoreCtx.measureText(text).width;
        if (width <= maxWidth && mid <= maxHeight) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    scoreEl.style.fontSize = `${lo}px`;
}

/** Nombres largos no pasan a una 2da línea: se comprimen horizontalmente
    (scaleX) para entrar en una sola línea, en vez de agrandar la ficha o
    achicar la altura de letra como hace fitScoreText con el puntaje.
    También se reusa para .throw-placeholder ("PUNTOS"): un ::placeholder
    nativo acepta transform en el CSSOM pero no lo pinta en este motor,
    así que el placeholder es un <span> real superpuesto al input (ver
    .throw-input-wrap en style.css) — mismo problema de texto que se
    corta, misma solución.

    Además centra por TINTA real, no por caja de avance: el ancho que
    devuelve measureText() (naturalWidth) es el "avance" del texto, pero
    en "Press Start 2P" la tinta de algunas palabras no queda pareja
    dentro de ese avance (ej. "PUNTOS" mide 150px de avance pero la
    tinta real va de 0 a 147 — sobran 3px a la derecha y 0 a la
    izquierda). Si se centra por avance, se ve descentrada a ojo aunque
    la CAJA esté perfectamente centrada. actualBoundingBoxLeft/Right da
    los bordes reales de la tinta para corregir ese desvío. */
function fitNameText(nameTextEl, options = {}) {
    if (!nameTextEl) return;
    nameTextEl.style.transform = 'none';

    const container = nameTextEl.parentElement;
    let maxWidth = container.clientWidth * 0.96;
    let extraShift = 0;

    // Los nombres deben APROVECHAR todo el espacio asignado (crecer) —
    // el tamaño de fuente apunta directo a la altura de .marker-icon-btn
    // (estable: no depende del propio texto, a diferencia de la fila
    // "name" de la grilla, que es "auto" y crecería en bucle si se
    // midiera contra sí misma). Si a ESE tamaño el nombre desborda el
    // ancho, el estrechado (scaleX) de acá abajo lo comprime.
    //
    // El ancho máximo y el centrado se calculan contra la posición REAL
    // de los botones (ícono izquierdo y X derecha), no contra los bordes
    // de la celda de grilla .player-name — la celda no siempre coincide
    // exactamente con dónde están esos botones (columnas 1/3 basadas en
    // % son una aproximación al ancho real de .marker-icon-btn, no un
    // calce exacto), así que centrar/limitar por la celda podía dejar
    // menos de los 10px pedidos de un lado. No se aplica a
    // .throw-placeholder ("PUNTOS"), que no tiene un botón externo
    // específico que evitar.
    if (options.growToFit) {
        const card = nameTextEl.closest('.player-card');
        const refBtn = card ? card.querySelector('.marker-icon-btn') : null;
        const iconBtn = card ? card.querySelector('.card-top-left .marker-icon-btn') : null;
        const xBtn = card ? card.querySelector('.btn-remove') : null;

        if (refBtn) {
            nameTextEl.style.fontSize = `${refBtn.getBoundingClientRect().height / 1.2}px`;
        }

        if (iconBtn && xBtn) {
            const leftBound = iconBtn.getBoundingClientRect().right + 10;
            const rightBound = xBtn.getBoundingClientRect().left - 10;
            maxWidth = Math.max(0, rightBound - leftBound);

            const trueCenter = (leftBound + rightBound) / 2;
            const cellRect = container.getBoundingClientRect();
            const cellCenter = cellRect.left + cellRect.width / 2;
            extraShift = trueCenter - cellCenter;
        }
    }

    if (maxWidth <= 0) return;

    const cs = getComputedStyle(nameTextEl);
    _fitScoreCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const metrics = _fitScoreCtx.measureText(nameTextEl.textContent);
    const naturalWidth = metrics.width;

    const inkLeftGap = -metrics.actualBoundingBoxLeft;
    const inkRightGap = naturalWidth - metrics.actualBoundingBoxRight;
    const shiftX = (inkRightGap - inkLeftGap) / 2;

    const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
    // extraShift va AFUERA de scaleX a propósito: es una corrección en
    // píxeles de pantalla ya finales (distancia real entre botones vs.
    // centro de la celda), no debe encogerse si el texto se comprime.
    nameTextEl.style.transform = `translateX(${extraShift}px) scaleX(${scale}) translateX(${shiftX}px)`;
}

let fitScoreResizeTimer = null;
function refitAllScores() {
    clearTimeout(fitScoreResizeTimer);
    fitScoreResizeTimer = setTimeout(() => {
        document.querySelectorAll('.player-score').forEach(fitScoreText);
        document.querySelectorAll('.player-name-text').forEach(el => fitNameText(el, { growToFit: true }));
        document.querySelectorAll('.throw-placeholder').forEach(el => fitNameText(el));
    }, 120);
}

/** Al redimensionar (o rotar el celular), no alcanza con reajustar el
    tamaño del número — hay que rearmar el grid entero por si se cruza el
    punto de quiebre a diseño de una sola columna (ver getSymmetricLayout). */
let relayoutTimer = null;
function debouncedRelayout() {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(renderPlayers, 150);
}

/** En pantallas angostas (celular en vertical), meter 2-3 fichas por
    fila las deja ilegibles — mejor una debajo de la otra a todo el
    ancho, con scroll vertical. */
const MOBILE_BREAKPOINT = 640;

/** Celular en horizontal: ancho de sobra pero muy poco alto — el grid de
    varias filas (pensado para monitores altos) las deja chicas o
    cortadas. Una sola fila con scroll horizontal (ver .player-row en
    style.css) mantiene las fichas a tamaño legible. */
const LANDSCAPE_MAX_HEIGHT = 500;
function isShortLandscape() {
    return window.innerWidth >= MOBILE_BREAKPOINT && window.innerHeight <= LANDSCAPE_MAX_HEIGHT;
}

function getSymmetricLayout(n) {
    if (n === 0) return [];
    if (window.innerWidth < MOBILE_BREAKPOINT) return new Array(n).fill(1);
    if (isShortLandscape()) return [n];
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

            const card = document.createElement('div');
            card.id = `card-${player.id}`;
            card.className = 'player-card' + (player.flashUntil && player.flashUntil > Date.now() ? ' flash-warning' : '');

            // Cada tiro es "la ronda N" de ESE jugador (1ra jugada = ronda 1,
            // 2da = ronda 2...). history está en orden más-nuevo-primero, así
            // que el número de ronda de la entrada en el índice i es
            // (total de tiros - i).
            const totalThrows = player.history.length;
            // El número grande de la ficha ya muestra el total acumulado —
            // repetirlo acá era redundante (queda justo encima). En su
            // lugar, el historial muestra cuánto falta para 420, en
            // negativo (result - TARGET_SCORE), como cuenta regresiva.
            const renderHistoryItem = (h, i) => {
                const roundNum = totalThrows - i;
                const remaining = h.result - TARGET_SCORE;
                return h.bust
                    ? `<div class="history-item history-bust">
                        <span>Ronda ${roundNum}: ${h.throw} pts. (Sobran ${h.sobrante})</span>
                        <span>→ ${remaining} pts.</span>
                    </div>`
                    : `<div class="history-item">
                        <span>Ronda ${roundNum}: ${h.throw} pts.</span>
                        <span>→ ${remaining} pts.</span>
                    </div>`;
            };

            // Franja fija: solo la última jugada. El resto se despliega al
            // pasar el mouse (ver .history-full / .card-middle:hover).
            const historyLastHTML = totalThrows ? renderHistoryItem(player.history[0], 0) : '';
            const historyFullHTML = player.history.map(renderHistoryItem).join('');

            card.innerHTML = `
                <div class="card-gradient" style="background: linear-gradient(90deg, transparent, ${color}, transparent);"></div>
                <button class="btn-remove marker-icon-btn" onclick="removePlayer('${player.id}')" style="border-color:${color}; color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Quitar Jugador">${iconMask('delete')}</button>

                <div class="card-top-left">
                    ${isKnownMusicianName(player.name) ? `
                    <a class="marker-icon-btn" href="${buildYoutubeSearchUrl(player.name)}" target="_blank" rel="noopener noreferrer" onclick="return openExternal(this.href)" style="border-color:${color}; color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Buscar en YouTube">${iconMask('notes')}</a>
                    ` : ''}
                    <button class="marker-icon-btn" onclick="changePlayerColor('${player.id}')" style="border-color:${color}; color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Cambiar apariencia">${iconMask('bucket')}</button>
                    <button class="marker-icon-btn" onclick="renamePlayer('${player.id}')" style="border-color:${color}; color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Editar personaje">${iconMask('pencil')}</button>
                    ${player.avatar ? `<img src="${player.avatar}" class="player-avatar" alt="">` : ''}
                </div>

                <div class="player-name" style="color: ${color};">
                    <span class="player-name-text">${escapeHTML(player.name)}</span>
                </div>

                <div class="card-middle">
                    <div class="player-score" style="text-shadow: 0 0 10px #fff, 0 0 20px ${color};">${player.score}</div>

                    <div class="history-strip">
                        <div class="history-last">${historyLastHTML}</div>
                        <div class="history-full">${historyFullHTML}</div>
                    </div>
                </div>

                <div class="throw-controls">
                    <button class="marker-icon-btn" onclick="undoLast('${player.id}')" style="border-color:${color}; color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Deshacer">${iconMask('undo')}</button>
                    <div class="throw-input-wrap">
                        <input type="number" id="input-${player.id}" class="throw-input" min="0" step="0.5" autocomplete="off" style="border-color:${color}; color:${color}; box-shadow: inset 0 0 10px ${color}20;">
                        <span class="throw-placeholder" style="color:${color};">PUNTOS</span>
                    </div>
                    <div class="throw-stepper" style="border-color:${color};">
                        <button type="button" class="throw-stepper-btn" onclick="adjustThrowInput('${player.id}', 1)" style="color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Sumar">▲</button>
                        <button type="button" class="throw-stepper-btn" onclick="adjustThrowInput('${player.id}', -1)" style="color:${color};" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Restar">▼</button>
                    </div>
                    <button class="marker-icon-btn" style="color:${color}; border-color:${color};" onclick="submitScore('${player.id}')" onmouseover="this.style.background='${color}20'" onmouseout="this.style.background='none'" title="Anotar">${iconMask('tick')}</button>
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
                    input.addEventListener('input', () => updatePlaceholderVisibility(input));
                    updatePlaceholderVisibility(input);
                }
                fitScoreText(card.querySelector('.player-score'));
                fitNameText(card.querySelector('.player-name-text'), { growToFit: true });
                fitNameText(card.querySelector('.throw-placeholder'));
            }, 0);

            playerIndex++;
        }
        playersContainer.appendChild(rowDiv);
    }
}

/** El "PUNTOS" es un <span> real superpuesto (ver .throw-input-wrap), no
    el placeholder nativo del input — así que hay que ocultarlo/mostrarlo
    a mano según si el input tiene texto, cosa que el navegador hacía
    solo con el placeholder de verdad. */
function updatePlaceholderVisibility(input) {
    const placeholder = input.parentElement.querySelector('.throw-placeholder');
    if (placeholder) placeholder.hidden = input.value !== '';
}

/** Sube/baja el valor del cuadro de puntos de a un paso — reemplaza a las
    flechitas nativas del input number, que quedaban tapando el placeholder
    "PUNTOS". stepUp/stepDown no disparan el evento 'input', así que hay
    que refrescar la visibilidad del placeholder a mano. */
function adjustThrowInput(playerId, direction) {
    const input = document.getElementById(`input-${playerId}`);
    if (!input) return;
    if (direction > 0) input.stepUp(); else input.stepDown();
    updatePlaceholderVisibility(input);
}
window.adjustThrowInput = adjustThrowInput;

/** Aplica el tiro tipeado apenas se toca OK, sin esperar a nadie más. */
function submitScore(playerId) {
    const input = document.getElementById(`input-${playerId}`);
    const points = parseFloat(input.value);
    if (isNaN(points) || points < 0) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const nextRound = player.history.length + 1;
    const stuck = players.find(p => p.id !== playerId && nextRound - p.history.length > 1);
    if (stuck) {
        showAlert(`${player.name} no puede anotar la ronda ${nextRound} todavía: falta que ${stuck.name} juegue la ronda ${nextRound - 1}.`);
        return;
    }

    handleScore(playerId, points);
    checkRoundSync(playerId);
}

/** No se puede anotar una ronda si algún otro jugador todavía no jugó la
    ronda anterior a esa — máximo 1 ronda de ventaja (ver submitScore).
    Además, si al anotar este jugador queda por delante de otros que
    todavía no jugaron esa misma ronda (menos tiros acumulados, pero
    dentro del límite permitido), sus fichas parpadean 5 segundos para
    avisar que faltan por tirar. No bloquea nada — solo avisa. */
function checkRoundSync(scoredPlayerId) {
    const scorer = players.find(p => p.id === scoredPlayerId);
    if (!scorer) return;
    const scorerThrows = scorer.history.length;
    const lagging = players.filter(p => p.id !== scoredPlayerId && p.history.length < scorerThrows);
    if (!lagging.length) return;

    const until = Date.now() + 5000;
    lagging.forEach(p => { p.flashUntil = until; });
    renderPlayers();
    setTimeout(renderPlayers, 5000);
}

// Make functions global for inline onclick
window.submitScore = submitScore;
window.undoLast = undoLast;
window.renamePlayer = renamePlayer;
window.changePlayerColor = changePlayerColor;
window.removePlayer = removePlayer;

function showWinner(player) {
    winnerPlayerId = player.id;
    winnerText.textContent = `${player.name} GANA!`;
    winnerModal.classList.remove('hidden');
    createWeedExplosion();
    playVictorySong();
}

/** Easter egg: tema de victoria al clavar el 420 exacto. */
function playVictorySong() {
    try {
        const audio = new Audio('sounds/victory.mp3');
        audio.play().catch(() => {
            // Si el navegador bloquea audio (sin interacción previa, etc.), no pasa nada.
        });
    } catch (e) {
        // Idem — no pasa nada si Audio() no está disponible.
    }
}

function getPixelLeafSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="width:100%; height:100%;">
        <path fill="var(--neon-green)" d="M 126.0,30.0 L 124.0,31.0 L 124.0,51.0 L 123.0,52.0 L 117.0,52.0 L 117.0,80.0 L 116.0,81.0 L 110.0,81.0 L 110.0,123.0 L 115.0,123.0 L 117.0,125.0 L 117.0,152.0 L 123.0,152.0 L 124.0,153.0 L 124.0,174.0 L 123.0,175.0 L 117.0,175.0 L 116.0,174.0 L 116.0,161.0 L 110.0,161.0 L 109.0,160.0 L 109.0,146.0 L 103.0,146.0 L 102.0,145.0 L 102.0,132.0 L 96.0,132.0 L 94.0,130.0 L 94.0,125.0 L 87.0,123.0 L 87.0,117.0 L 81.0,117.0 L 80.0,116.0 L 80.0,103.0 L 74.0,103.0 L 73.0,102.0 L 73.0,96.0 L 66.0,94.0 L 66.0,88.0 L 60.0,88.0 L 58.0,81.0 L 52.0,81.0 L 51.0,80.0 L 51.0,74.0 L 45.0,74.0 L 44.0,73.0 L 44.0,67.0 L 38.0,67.0 L 38.0,73.0 L 44.0,73.0 L 45.0,74.0 L 45.0,87.0 L 51.0,87.0 L 52.0,88.0 L 52.0,102.0 L 59.0,102.0 L 60.0,103.0 L 60.0,123.0 L 65.0,123.0 L 67.0,125.0 L 67.0,131.0 L 73.0,131.0 L 74.0,132.0 L 74.0,145.0 L 80.0,145.0 L 81.0,146.0 L 81.0,152.0 L 87.0,152.0 L 88.0,153.0 L 88.0,159.0 L 95.0,161.0 L 95.0,167.0 L 102.0,167.0 L 103.0,168.0 L 103.0,174.0 L 109.0,174.0 L 110.0,175.0 L 110.0,181.0 L 109.0,182.0 L 95.0,182.0 L 94.0,181.0 L 94.0,175.0 L 88.0,175.0 L 87.0,174.0 L 87.0,168.0 L 74.0,168.0 L 73.0,167.0 L 73.0,161.0 L 60.0,161.0 L 58.0,153.0 L 38.0,153.0 L 36.0,146.0 L 23.0,146.0 L 23.0,152.0 L 29.0,152.0 L 31.0,160.0 L 44.0,160.0 L 45.0,161.0 L 45.0,167.0 L 51.0,167.0 L 52.0,168.0 L 52.0,174.0 L 59.0,174.0 L 60.0,175.0 L 60.0,181.0 L 73.0,181.0 L 74.0,182.0 L 74.0,188.0 L 94.0,188.0 L 95.0,189.0 L 95.0,195.0 L 101.0,195.0 L 103.0,197.0 L 103.0,197.0 L 103.0,203.0 L 102.0,204.0 L 81.0,204.0 L 81.0,210.0 L 80.0,211.0 L 74.0,211.0 L 74.0,217.0 L 94.0,217.0 L 94.0,211.0 L 95.0,210.0 L 116.0,210.0 L 116.0,204.0 L 117.0,203.0 L 123.0,203.0 L 124.0,204.0 L 124.0,224.0 L 125.0,225.0 L 130.0,225.0 L 131.0,223.0 L 131.0,204.0 L 132.0,203.0 L 138.0,203.0 L 139.0,204.0 L 139.0,210.0 L 160.0,210.0 L 161.0,211.0 L 161.0,217.0 L 181.0,217.0 L 181.0,211.0 L 175.0,211.0 L 174.0,210.0 L 174.0,204.0 L 153.0,204.0 L 152.0,203.0 L 152.0,197.0 L 154.0,195.0 L 160.0,195.0 L 160.0,189.0 L 161.0,188.0 L 181.0,188.0 L 181.0,182.0 L 182.0,181.0 L 195.0,181.0 L 195.0,176.0 L 197.0,174.0 L 203.0,174.0 L 203.0,168.0 L 204.0,167.0 L 210.0,167.0 L 210.0,161.0 L 211.0,160.0 L 223.0,160.0 L 225.0,158.0 L 225.0,153.0 L 226.0,152.0 L 232.0,152.0 L 232.0,146.0 L 219.0,146.0 L 217.0,153.0 L 197.0,153.0 L 195.0,161.0 L 182.0,161.0 L 182.0,167.0 L 181.0,168.0 L 168.0,168.0 L 168.0,174.0 L 167.0,175.0 L 161.0,175.0 L 161.0,181.0 L 160.0,182.0 L 146.0,182.0 L 145.0,181.0 L 145.0,175.0 L 146.0,174.0 L 152.0,174.0 L 152.0,168.0 L 153.0,167.0 L 159.0,167.0 L 161.0,160.0 L 167.0,160.0 L 167.0,153.0 L 168.0,152.0 L 174.0,152.0 L 174.0,146.0 L 175.0,145.0 L 181.0,145.0 L 181.0,132.0 L 182.0,131.0 L 188.0,131.0 L 188.0,125.0 L 190.0,123.0 L 195.0,123.0 L 195.0,103.0 L 196.0,102.0 L 203.0,102.0 L 203.0,88.0 L 204.0,87.0 L 210.0,87.0 L 210.0,74.0 L 211.0,73.0 L 217.0,73.0 L 217.0,67.0 L 211.0,67.0 L 211.0,73.0 L 210.0,74.0 L 204.0,74.0 L 204.0,80.0 L 203.0,81.0 L 197.0,81.0 L 196.0,82.0 L 197.0,86.0 L 195.0,88.0 L 190.0,88.0 L 188.0,95.0 L 183.0,95.0 L 182.0,96.0 L 182.0,102.0 L 181.0,103.0 L 175.0,103.0 L 175.0,116.0 L 174.0,117.0 L 168.0,117.0 L 168.0,123.0 L 165.0,125.0 L 161.0,125.0 L 161.0,130.0 L 160.0,131.0 L 153.0,132.0 L 153.0,145.0 L 152.0,146.0 L 146.0,146.0 L 146.0,160.0 L 145.0,161.0 L 139.0,161.0 L 139.0,174.0 L 138.0,175.0 L 132.0,175.0 L 131.0,174.0 L 131.0,153.0 L 132.0,152.0 L 138.0,152.0 L 138.0,124.0 L 139.0,123.0 L 145.0,123.0 L 145.0,81.0 L 139.0,81.0 L 138.0,80.0 L 138.0,52.0 L 132.0,52.0 L 131.0,51.0 L 131.0,31.0 Z"/>
    </svg>`;
}

function createWeedExplosion() {
    const leafSVG = getPixelLeafSVG();

    for (let i = 0; i < 100; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'weed-leaf';
        leaf.innerHTML = leafSVG;

        const angle = Math.random() * Math.PI * 2;
        const velocity = 20 + Math.random() * 80;
        const tx = Math.cos(angle) * velocity + 'vw';
        const ty = Math.sin(angle) * velocity + 'vh';
        const rot = (Math.random() * 1080 - 540) + 'deg';

        leaf.style.setProperty('--tx', tx);
        leaf.style.setProperty('--ty', ty);
        leaf.style.setProperty('--rot', rot);

        const sizeWidth = 30 + Math.random() * 50;
        leaf.style.width = sizeWidth + 'px';
        leaf.style.height = sizeWidth + 'px';

        leaf.style.animationDuration = (1.5 + Math.random() * 2) + 's';

        document.body.appendChild(leaf);

        setTimeout(() => {
            if (document.body.contains(leaf)) {
                leaf.remove();
            }
        }, 4000);
    }
}

function clearWeedLeaves() {
    document.querySelectorAll('.weed-leaf').forEach(e => e.remove());
}

/** Registra la partida terminada en el historial y, si hay un ganador con
    perfil guardado, le suma una partida ganada a sus stats. Cada partida es
    única — no hay mangas ni repeticiones dentro de la misma partida. */
function recordFinishedGame() {
    const finishedPlayers = players.map(p => ({
        profileId: p.profileId || null,
        name: p.name,
        finalScore: p.score,
        won: p.id === winnerPlayerId,
        throwCount: p.history.length,
        throws: [...p.history].reverse().map(h => h.throw),
    }));
    Store.recordLeg({ legNumber: 1, target: TARGET_SCORE, players: finishedPlayers, matchId: currentMatchId });

    const winner = players.find(p => p.id === winnerPlayerId);
    if (winner && winner.profileId) {
        Store.finalizeMatch({ [winner.profileId]: 1 });
    }
}

function clearScores() {
    players.forEach(p => {
        p.score = 0;
        p.history = [];
    });
}

/** Única forma de volver a jugar: archiva la partida recién terminada y
    arranca una nueva con los mismos jugadores, puntajes en cero. */
function resetMatch() {
    recordFinishedGame();
    clearScores();
    winnerPlayerId = null;
    currentMatchId = uid();
    winnerModal.classList.add('hidden');
    clearWeedLeaves();
    persistCurrentMatch();
    renderPlayers();
}

function persistCurrentMatch() {
    Store.saveCurrentMatch({
        matchId: currentMatchId,
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            skin: p.skin.id,
            score: p.score,
            history: p.history,
            profileId: p.profileId,
        })),
    });
}

/* ---- biblioteca de músicos ---- */

function openLibraryModal() {
    librarySearchInput.value = '';
    renderLibraryList('');
    libraryModal.classList.remove('hidden');
}

function renderLibraryList(query) {
    const q = query.trim().toLowerCase();
    const entries = [];
    Object.entries(MUSICIAN_ROLES).forEach(([role, names]) => {
        names.forEach(n => entries.push({ name: n, role }));
    });
    const filtered = (q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (!filtered.length) {
        libraryMusicianList.innerHTML = '<p class="empty-hint">No se encontraron músicos.</p>';
        return;
    }
    libraryMusicianList.innerHTML = filtered.map(e => {
        const inPlay = players.some(p => p.name === e.name.toUpperCase());
        return `
            <button class="player-chip${inPlay ? ' disabled' : ''}" data-name="${escapeHTML(e.name)}" ${inPlay ? 'disabled' : ''}>
                ${escapeHTML(e.name)}
                <span class="chip-role">${escapeHTML(ROLE_LABELS[e.role] || e.role)}</span>
            </button>
        `;
    }).join('');
}

function handleLibraryListClick(e) {
    const btn = e.target.closest('button[data-name]');
    if (!btn || btn.disabled) return;
    if (editingPlayerId) {
        applyPlayerIdentity(editingPlayerId, btn.dataset.name);
    } else {
        addPlayer(btn.dataset.name, null);
    }
    closeNewPlayerFlow();
}

function renderMusicianRoleOptions() {
    newMusicianRoleSelect.innerHTML = Object.entries(ROLE_LABELS)
        .map(([key, label]) => `<option value="${key}">${escapeHTML(label)}</option>`).join('');
}

function openAddMusicianModal() {
    newMusicianNameInput.value = '';
    addMusicianModal.classList.remove('hidden');
}

function handleSaveMusician() {
    const name = newMusicianNameInput.value.trim();
    const role = newMusicianRoleSelect.value;
    if (!name) return;
    if (isKnownMusicianName(name)) {
        showAlert('Ya existe un músico con ese nombre.');
        return;
    }
    const result = Store.addCustomMusician(name, role);
    if (!result || result.dupe) {
        showAlert('Ya existe un músico con ese nombre.');
        return;
    }
    addMusicianToRuntime(name, role);
    addMusicianModal.classList.add('hidden');
    renderLibraryList(librarySearchInput.value);
}

/* ---- perfiles (solo nombres personalizados) ---- */

const RANKS = [
    { name: 'Dios', min: 22 },
    { name: 'Platino', min: 16 },
    { name: 'Oro', min: 11 },
    { name: 'Plata', min: 7 },
    { name: 'Bronce', min: 4 },
    { name: 'Latón', min: 2 },
    { name: 'Cobre', min: 1 },
    { name: 'Madera', min: 0 },
];

function getRank(matchesWon) {
    return RANKS.find(r => matchesWon >= r.min).name;
}

function openProfilesModal() {
    renderProfilesList();
    profilesModal.classList.remove('hidden');
}

function renderProfilesList() {
    if (!Store.data.profiles.length) {
        profilesList.innerHTML = '<p class="empty-hint">Todavía no hay perfiles guardados — creá un jugador con nombre personalizado.</p>';
        return;
    }
    profilesList.innerHTML = Store.data.profiles.map(profile => {
        const skin = resolveSkin(profile.skin, profile.customColor);
        const winRate = profile.stats.legsPlayed
            ? Math.round((profile.stats.legsWon / profile.stats.legsPlayed) * 100)
            : 0;
        const inPlay = players.some(p => p.profileId === profile.id);
        const rank = getRank(profile.stats.matchesWon);
        const swatch = profile.avatar
            ? `<img src="${profile.avatar}" class="profile-swatch profile-swatch-photo" alt="">`
            : `<div class="profile-swatch" style="background:${skin.primary}; border-color:${skin.accent};"></div>`;
        return `
            <div class="profile-card">
                <button class="profile-header profile-pick" data-profile-id="${profile.id}" ${inPlay ? 'disabled' : ''} title="${inPlay ? 'Ya está en juego' : 'Añadir a la partida'}">
                    ${swatch}
                    <div class="profile-info">
                        <div class="profile-name">${escapeHTML(profile.name)}</div>
                        <div class="profile-rank">🏅 ${rank}</div>
                        <div class="profile-stats">
                            ${profile.stats.legsWon}/${profile.stats.legsPlayed} partidas jugadas (${winRate}%) · ${profile.stats.matchesWon} ganadas
                        </div>
                    </div>
                </button>
                <div class="profile-actions">
                    <button class="retro-btn compact icon-btn" onclick="cycleProfileSkin('${profile.id}')" title="Cambiar apariencia">🎨</button>
                    <button class="retro-btn compact" onclick="renameProfile('${profile.id}')">RENOMBRAR</button>
                    <button class="retro-btn compact yellow" onclick="deleteProfile('${profile.id}')">BORRAR</button>
                </div>
            </div>
        `;
    }).join('');
}

function handleProfilesListClick(e) {
    const btn = e.target.closest('.profile-pick');
    if (!btn || btn.disabled) return;
    if (editingPlayerId) {
        applyPlayerIdentityFromProfile(editingPlayerId, btn.dataset.profileId);
    } else {
        addPlayer(null, btn.dataset.profileId);
    }
    closeNewPlayerFlow();
}

window.cycleProfileSkin = function(profileId) {
    openSkinModal({ type: 'profile', id: profileId });
};

window.renameProfile = function(profileId) {
    const profile = Store.profile(profileId);
    if (!profile) return;
    showRename(profile.name, (newName) => {
        Store.updateProfile(profileId, { name: newName.toUpperCase() });
        const inPlay = players.find(p => p.profileId === profileId);
        if (inPlay) {
            inPlay.name = newName.toUpperCase();
            persistCurrentMatch();
            renderPlayers();
        }
        renderProfilesList();
    });
};

window.deleteProfile = function(profileId) {
    showConfirm('¿Seguro que querés borrar este perfil? Se pierden sus estadísticas.', () => {
        Store.removeProfile(profileId);
        players.forEach(p => { if (p.profileId === profileId) p.profileId = null; });
        persistCurrentMatch();
        renderProfilesList();
    });
};

/* ---- apariencia: color RGB personalizado, foto desde PC o webcam ---- */

function getSkinTargetEntity() {
    if (!skinTarget) return null;
    if (skinTarget.type === 'player') return players.find(p => p.id === skinTarget.id);
    if (skinTarget.type === 'profile') return Store.profile(skinTarget.id);
    return null;
}

function openSkinModal(target) {
    skinTarget = target;
    const entity = getSkinTargetEntity();
    // Un player.skin ya es el objeto resuelto {primary,...}; un profile.skin
    // es solo el id guardado, hay que resolverlo (soporta color 'custom').
    const primary = entity
        ? (target.type === 'player' ? entity.skin.primary : resolveSkin(entity.skin, entity.customColor).primary)
        : '#00ffff';
    skinColorInput.value = primary;
    const avatar = entity ? entity.avatar : null;
    if (avatar) {
        skinPhotoPreview.src = avatar;
        skinPhotoPreviewWrap.classList.remove('hidden');
    } else {
        skinPhotoPreview.src = '';
        skinPhotoPreviewWrap.classList.add('hidden');
    }
    skinModal.classList.remove('hidden');
}

function closeSkinModal() {
    closeWebcam();
    skinModal.classList.add('hidden');
    skinTarget = null;
}

/** Aplica un cambio de skin/avatar al jugador o perfil elegido en
    openSkinModal. patch puede traer `skin` (objeto {id,label,primary,accent})
    y/o `avatar` (dataURL o null). */
function applySkinPatchToTarget(patch) {
    if (!skinTarget) return;

    if (skinTarget.type === 'player') {
        const player = players.find(p => p.id === skinTarget.id);
        if (!player) return;
        if (patch.skin) player.skin = patch.skin;
        if ('avatar' in patch) player.avatar = patch.avatar;

        if (player.profileId) {
            const profilePatch = {};
            if (patch.skin) {
                profilePatch.skin = patch.skin.id;
                profilePatch.customColor = patch.skin.id === 'custom' ? patch.skin.primary : null;
            }
            if ('avatar' in patch) profilePatch.avatar = patch.avatar;
            Store.updateProfile(player.profileId, profilePatch);
        }
        persistCurrentMatch();
        renderPlayers();
    } else if (skinTarget.type === 'profile') {
        const profile = Store.profile(skinTarget.id);
        if (!profile) return;
        const profilePatch = {};
        if (patch.skin) {
            profilePatch.skin = patch.skin.id;
            profilePatch.customColor = patch.skin.id === 'custom' ? patch.skin.primary : null;
        }
        if ('avatar' in patch) profilePatch.avatar = patch.avatar;
        Store.updateProfile(skinTarget.id, profilePatch);

        const inPlay = players.find(p => p.profileId === skinTarget.id);
        if (inPlay) {
            if (patch.skin) inPlay.skin = patch.skin;
            if ('avatar' in patch) inPlay.avatar = patch.avatar;
            persistCurrentMatch();
            renderPlayers();
        }
        renderProfilesList();
    }
}

function handleSaveSkinColor() {
    const hex = skinColorInput.value;
    applySkinPatchToTarget({ skin: { id: 'custom', label: 'Personalizado', primary: hex, accent: hex } });
}

/** Recorta y reescala una imagen (o el frame de un <video>) a un cuadrado
    de AVATAR_SIZE px, para no inflar localStorage con fotos a resolución
    completa. */
function resizeImageToDataURL(source, callback) {
    const canvas = skinWebcamCanvas || document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    const iw = source.naturalWidth || source.videoWidth;
    const ih = source.naturalHeight || source.videoHeight;
    const scale = Math.max(AVATAR_SIZE / iw, AVATAR_SIZE / ih);
    const sw = AVATAR_SIZE / scale;
    const sh = AVATAR_SIZE / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    callback(canvas.toDataURL('image/jpeg', 0.8));
}

function showPhotoPreview(dataUrl) {
    skinPhotoPreview.src = dataUrl;
    skinPhotoPreviewWrap.classList.remove('hidden');
}

function handlePhotoFileSelected() {
    const file = skinFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            resizeImageToDataURL(img, (dataUrl) => {
                showPhotoPreview(dataUrl);
                applySkinPatchToTarget({ avatar: dataUrl });
            });
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
    skinFileInput.value = '';
}

function handleClearPhoto() {
    skinPhotoPreviewWrap.classList.add('hidden');
    skinPhotoPreview.src = '';
    applySkinPatchToTarget({ avatar: null });
}

async function openWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
        showAlert('No se pudo acceder a la cámara. Revisá los permisos.');
        return;
    }
    skinWebcamVideo.srcObject = webcamStream;
    skinWebcamWrap.classList.remove('hidden');
}

function closeWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
    }
    skinWebcamVideo.srcObject = null;
    skinWebcamWrap.classList.add('hidden');
}

function captureWebcamPhoto() {
    resizeImageToDataURL(skinWebcamVideo, (dataUrl) => {
        showPhotoPreview(dataUrl);
        applySkinPatchToTarget({ avatar: dataUrl });
        closeWebcam();
    });
}

/* ---- historial ---- */

function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove('hidden');
}

function renderHistoryList() {
    if (!Store.data.matchHistory.length) {
        historyList.innerHTML = '<p class="empty-hint">Todavía no hay partidas registradas.</p>';
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
                    <span>${date}</span>
                </div>
                ${rows}
            </div>
        `;
    }).join('');
}

/* ---- gráfico de puntuación ----
   Canvas dibujado a mano (sin librería). Cada partida es única, así que
   siempre hay un solo sector en el eje X con la serie aditiva de puntos
   tirados por cada jugador en la partida en curso. */

function getMatchLegsInOrder() {
    return [{
        players: players.map(p => ({
            profileId: p.profileId || null,
            name: p.name,
            // resultado real tras cada tiro (ya con el rebote de "te pasás,
            // se resta el sobrante" aplicado) — no el tiro crudo, que
            // ignoraría esa regla y seguiría subiendo de largo.
            throwResults: [...p.history].reverse().map(h => ({ result: h.result, bust: h.bust })),
        })),
    }];
}

/** Resultados (post-rebote) de un jugador en una manga dada, o null si no
    jugó esa manga. */
function getPlayerResultsInLeg(leg, player) {
    const entry = leg.players.find(p =>
        player.profileId ? p.profileId === player.profileId : (!p.profileId && p.name === player.name));
    return entry ? entry.throwResults : null;
}

/** Serie de un jugador a lo largo de toda la partida: cada manga ocupa un
    sector [i, i+1) del eje X. Usa el resultado real de cada tiro (no la
    suma cruda) — si el tiro se pasó de 420, la línea sube hasta 420 y
    "rebota" hacia abajo hasta el resultado con el sobrante restado. */
function buildPlayerSeries(player, legs) {
    const points = [];
    legs.forEach((leg, legIdx) => {
        const throwResults = getPlayerResultsInLeg(leg, player);
        if (throwResults === null) return;
        points.push({ x: legIdx, y: 0 });
        throwResults.forEach((h, i) => {
            const xStart = legIdx + i / throwResults.length;
            const xEnd = legIdx + (i + 1) / throwResults.length;
            if (h.bust) {
                points.push({ x: xStart + (xEnd - xStart) * 0.5, y: TARGET_SCORE });
            }
            points.push({ x: xEnd, y: h.result });
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
        const color = p.skin.primary;
        // El círculo es la foto de perfil si tiene una asignada; si no, su
        // color — y el nombre siempre en su color, tenga perfil o no.
        const swatch = p.avatar
            ? `<img src="${p.avatar}" class="legend-swatch legend-swatch-photo" alt="">`
            : `<span class="legend-swatch" style="background:${color};"></span>`;
        return `
        <div class="legend-item">
            ${swatch}
            <span style="color:${color};">${escapeHTML(p.name)} — ${total} pts acumulados</span>
        </div>
    `;
    }).join('');
}

/** Líneas fijas del eje Y: en vez de escalar según el puntaje de la
    partida, siempre marca los mismos cortes alrededor del objetivo (420),
    con 420 remarcado en verde por ser la meta. GRAPH_MAX_Y da un poco de
    margen arriba de 420 para las líneas que se pasan, sin dibujar esa
    marca (ya no se muestra el 525). */
const GRAPH_MAX_Y = 460;
const GRAPH_GRIDLINES = [
    { value: 0, color: '#000000' },
    { value: 105, color: '#000000' },
    { value: 210, color: '#e63946' },
    { value: 315, color: '#c98a00' },
    { value: 420, color: '#2ecc16' },
];
const GRAPH_BG = '#cfcfcf';

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

    const xFor = (x) => padding.left + (x / numLegs) * plotW;
    const yFor = (value) => padding.top + plotH - (value / GRAPH_MAX_Y) * plotH;

    // fondo "blanco roto" de TODO el canvas (no solo el área graficada) para
    // que los números del eje Y, que viven en el margen izquierdo, también
    // tengan contraste — si no, el negro del 0/105 desaparece contra el
    // fondo oscuro de la app.
    ctx.fillStyle = GRAPH_BG;
    ctx.fillRect(0, 0, width, height);

    // sectores por ronda (fondo alternado + líneas divisorias)
    for (let i = 0; i < numLegs; i++) {
        if (i % 2 === 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.04)';
            ctx.fillRect(xFor(i), padding.top, xFor(i + 1) - xFor(i), plotH);
        }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numLegs; i++) {
        ctx.beginPath();
        ctx.moveTo(xFor(i), padding.top);
        ctx.lineTo(xFor(i), padding.top + plotH);
        ctx.stroke();
    }

    // gridlines + eje Y (valores y colores fijos; 420 = objetivo, en verde)
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    GRAPH_GRIDLINES.forEach(({ value, color }) => {
        const y = yFor(value);
        ctx.strokeStyle = color;
        ctx.lineWidth = value === TARGET_SCORE ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(String(value), padding.left - 10, y);
    });

    // series por jugador
    series.forEach(({ player, points }) => {
        if (!points.length) return;
        const color = player.skin.primary;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
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

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotW, plotH);
}

// Initialize
init();
