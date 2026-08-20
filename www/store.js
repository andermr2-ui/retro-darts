/* Retro Darts 420 — persistencia en localStorage */

const SKINS = [
  { id: 'cian', label: 'Cian Ártico', primary: '#00ffff', accent: '#0088ff' },
  { id: 'magenta', label: 'Magenta Arcade', primary: '#ff00ff', accent: '#ff0088' },
  { id: 'verde', label: 'Verde Matrix', primary: '#39ff14', accent: '#00ff88' },
  { id: 'amarillo', label: 'Amarillo Turbo', primary: '#ffff00', accent: '#ff8800' },
  { id: 'rojo', label: 'Rojo Alerta', primary: '#ff3333', accent: '#ff0066' },
  { id: 'naranja', label: 'Naranja Sunset', primary: '#ff9900', accent: '#ff3300' },
  { id: 'violeta', label: 'Violeta Cyber', primary: '#a800ff', accent: '#6600ff' },
  { id: 'blanco', label: 'Blanco Fantasma', primary: '#ffffff', accent: '#cccccc' },
];

const MAX_HISTORY = 200;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function skinById(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

const Store = {
  KEY: 'retrodarts.v1',
  data: { profiles: [], matchHistory: [], currentMatch: null },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data.profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
        this.data.matchHistory = Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [];
        this.data.currentMatch = parsed.currentMatch || null;
      }
    } catch (e) {
      console.warn('Datos corruptos, empiezo de cero.', e);
    }
    return this.data;
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  /* ---- perfiles ---- */
  profile(id) { return this.data.profiles.find(p => p.id === id) || null; },

  addProfile(name, skinId) {
    const clean = (name || '').trim();
    if (!clean) return null;
    const dupe = this.data.profiles.find(p => p.name.toLowerCase() === clean.toLowerCase());
    if (dupe) return { dupe };
    const profile = {
      id: uid(),
      name: clean,
      skin: skinById(skinId).id,
      stats: { legsPlayed: 0, legsWon: 0, matchesWon: 0 },
    };
    this.data.profiles.push(profile);
    this.save();
    return { profile };
  },

  updateProfile(id, patch) {
    const profile = this.profile(id);
    if (!profile) return;
    Object.assign(profile, patch);
    this.save();
  },

  removeProfile(id) {
    this.data.profiles = this.data.profiles.filter(p => p.id !== id);
    this.save();
  },

  /* ---- historial ---- */
  recordLeg({ legNumber, target, players, matchId }) {
    this.data.matchHistory.unshift({
      id: uid(),
      date: new Date().toISOString(),
      legNumber,
      target,
      matchId: matchId || null,
      players,
    });
    if (this.data.matchHistory.length > MAX_HISTORY) {
      this.data.matchHistory.length = MAX_HISTORY;
    }
    players.forEach(p => {
      if (!p.profileId) return;
      const profile = this.profile(p.profileId);
      if (!profile) return;
      profile.stats.legsPlayed++;
      if (p.won) profile.stats.legsWon++;
    });
    this.save();
  },

  /** Se llama al terminar una partida (botón RESET) con el conteo de mangas
      ganadas por jugador dentro de esa partida. Si hay un único líder claro
      (sin empate), le suma una partida ganada a su perfil. */
  finalizeMatch(legWins) {
    const entries = Object.entries(legWins).filter(([, wins]) => wins > 0);
    if (!entries.length) return;
    const max = Math.max(...entries.map(([, wins]) => wins));
    const leaders = entries.filter(([, wins]) => wins === max);
    if (leaders.length !== 1) return;
    const [profileId] = leaders[0];
    const profile = this.profile(profileId);
    if (!profile) return;
    profile.stats.matchesWon++;
    this.save();
  },

  /* ---- partida en curso ---- */
  saveCurrentMatch(match) {
    this.data.currentMatch = match;
    this.save();
  },

  clearCurrentMatch() {
    this.data.currentMatch = null;
    this.save();
  },
};
