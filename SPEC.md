# Retro Darts 420 — Especificación

App de anotador de dardos (objetivo: llegar a **420 puntos exactos**), con
estética neón/pixel-art retro. Web plana (HTML/CSS/JS, sin bundler ni
framework) empaquetada como app de escritorio con **Tauri v2**.

## Reglas del juego

- Objetivo: **420 puntos exactos**.
- Si un tiro hace que el jugador se pase de 420, el sobrante se resta: el
  puntaje rebota a `420 - sobrante` (ver `handleScore` en `www/script.js`).
- **Cada partida es única e irrepetible**: no hay mangas ni repeticiones
  dentro de una misma partida. Al ganar, el único botón disponible es
  RESET, que archiva la partida en el historial y arranca una nueva con
  los mismos jugadores en cero.
- **Cada vez que se recarga la página (F5), arranca una partida nueva**
  con una banda aleatoria — no se restaura ninguna partida guardada.
- **Aviso de ronda desincronizada**: si un jugador anota quedando por
  delante de otros que no tiraron esa misma ronda (menos tiros
  acumulados), las fichas de esos jugadores parpadean 5 segundos. No
  bloquea nada, solo avisa.

## Identidad de los jugadores: músico vs. personalizado

Esta es la distinción central de la app:

- **Nombre de músico** (de la biblioteca, `www/musicians.json`): jugador
  de una sola partida. No genera perfil, no guarda progreso, no acumula
  rango ni victorias. Al reiniciar/recargar, desaparece.
- **Nombre personalizado** (cualquier texto que NO coincida con un
  músico conocido): genera o reutiliza un **perfil** guardado en
  `localStorage`, con estadísticas (partidas jugadas/ganadas) y un
  **rango** según victorias:

  | Rango    | Victorias mínimas |
  |----------|---|
  | Madera   | 0 |
  | Cobre    | 1 |
  | Latón    | 2 |
  | Bronce   | 4 |
  | Plata    | 7 |
  | Oro      | 11 |
  | Platino  | 16 |
  | Dios     | 22 |

La comprobación la hace `isKnownMusicianName()` en `www/script.js`.

## Biblioteca de músicos

- Fuente base: `www/musicians.json` (también hay una copia editable de
  referencia en `retrodarts_musician_list.json` en la raíz — el archivo
  que de verdad usa la app en runtime es el de `www/`).
- Categorías por instrumento: `guitarras`, `bajistas`, `cuerda_frotada`,
  `teclados_pianos`, `viento_metal`, `viento_madera`,
  `percusion_baterias`, `cantantes_frontmen`, `raperos`,
  `productores_djs`.
- **Banda aleatoria al abrir la app**: `formRandomBand()` arma una
  formación de 3 a 5 músicos usando `BAND_TEMPLATES` (plantillas de
  roles, no de personas — evita cosas como 3 guitarristas o 2 cantantes
  sin bajista). Simula una jam real: el anfitrión agrupa músicos que
  "podrían" tocar juntos.
- **Añadir músicos nuevos**: desde el popup BIBLIOTECA (botón `+`), se
  guardan en `localStorage` (`Store.data.customMusicians`) y se
  mezclan en memoria con `mergeCustomMusicians()` al cargar.

## Popups / flujo de UI

- **JUGADOR NUEVO** (botón centrado bajo el título, ahora dice
  "¡JUGAR!" al guardar): nombre libre + botón aleatorio (imagen propia,
  no genérica) + acceso a BIBLIOTECA y PERFILES. Reutilizado también
  como popup de **edición** (lápiz en cada ficha) — mismo formulario,
  pero cambia la identidad del jugador ya en juego en vez de agregar uno
  nuevo.
- **BIBLIOTECA**: lista buscable de músicos, agrupados por instrumento
  visible en cada fila. Click en un músico = lo suma a la partida (o
  reemplaza al jugador en edición).
- **PERFILES**: solo nombres personalizados. Muestra rango, stats, y
  permite click para sumar el perfil a la partida, cambiarle el skin,
  renombrarlo o borrarlo.
- **HISTORIAL**: partidas archivadas (fecha + puntaje final de cada
  jugador + ganador).
- **PUNTUACIÓN** (gráfico): progreso de puntos de la partida en curso.
  Eje Y fijo en 0/105/210/315/420 (sin la marca de 525), con 420 en
  verde brillante (el objetivo), 210 en rojo, 315 en dorado. Fondo
  gris claro (`rgb(207,207,207)`) para contraste. Si un tiro pasa de
  420, la línea sube hasta el tope y "rebota" hacia abajo hasta el
  resultado real (ver `buildPlayerSeries`).

## Apariencia de cada jugador (skin)

Botón 🎨→balde (`changePlayerColor` → `openSkinModal`): permite elegir
un **color RGB personalizado** (input nativo `type=color`), **subir una
foto** desde el PC, o **sacarla con la webcam**. Las fotos se
redimensionan a 160×160px antes de guardarse (evita inflar
`localStorage`). Si un jugador con perfil tiene foto, se muestra en vez
del círculo de color en Perfiles y en la leyenda del gráfico — pero
nunca en la ficha de la partida (ahí solo se ve el color).

## Íconos

Todos los íconos de acción (balde/skin, notas/YouTube, lápiz/editar,
flecha de deshacer, reloj/historial, flecha de gráfico) son **imágenes
dibujadas a mano** (ver carpeta `ICONOS/` — originales sin procesar) en
blanco y negro puro, sin sombreado. Se procesan (blanco → transparente,
negro → opaco) y se guardan en `www/icons/` para poder aplicarse como
**máscara CSS** (`.icon-mask`, `background-color: currentColor` +
`mask-image`): así cada ícono se colorea automáticamente con el color
del jugador dueño del botón, sin tener el color horneado en el archivo.

Excepción: el botón de **nombre aleatorio** (`www/icons/dice.png`) es
una imagen literal del botón completo (con su propio marco y color),
mostrada tal cual a su tamaño real — no pasa por la técnica de máscara.

Para agregar/reemplazar un ícono de máscara: dibujar en blanco y negro
puro (sin gradientes ni antialiasing) sobre fondo blanco, avisar la
ruta del archivo, y se reprocesa con un script Python (Pillow) que
convierte blanco→transparente y guarda en `www/icons/`.

## Botón "Link YouTube" (♫)

Solo aparece si el nombre del jugador es un músico conocido de la
biblioteca. Abre `youtube.com/results?search_query=NOMBRE` — el jugador
elige qué tema poner de los resultados, la app solo arma la búsqueda.

Dentro de la **app de escritorio** (Tauri), un `<a target="_blank">`
normal navegaría la misma ventana en vez de abrir el navegador del
sistema (se perdería la partida en curso). Por eso se agregó
`tauri-plugin-opener`: `openExternal()` en `www/script.js` detecta
`window.__TAURI__` y usa el plugin en ese caso; en cualquier navegador
normal (incluida esta misma app corriendo como página web) usa el
comportamiento nativo de `target="_blank"`.

**⚠️ Sin verificar de punta a punta**: no hay Rust/Cargo instalado en el
entorno donde se desarrolló esto, así que el cambio del plugin no se
pudo compilar ni probar en la app real. Si al compilar tira error,
revisar `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` y
`src-tauri/capabilities/default.json`.

## Tamaño del número de puntaje

El puntaje grande de cada ficha **no** usa un tamaño de fuente fijo en
CSS — se calcula por JS (`fitScoreText` en `www/script.js`) midiendo el
texto real con `canvas.measureText()` contra el espacio disponible de
esa ficha en particular (por búsqueda binaria del tamaño más grande que
entra sin cortarse). Se recalcula al cambiar la cantidad de jugadores y
al redimensionar la ventana (`refitAllScores`, con debounce). Esto
evita que un "420" se corte en fichas angostas, o que el número se vea
chico cuando sobra espacio.

## Cosas a tener en cuenta / deuda conocida

- `retrodarts_musician_list.json` (raíz) es la fuente "de mano" de la
  lista de músicos; `www/musicians.json` es la copia que la app carga
  en runtime. Si se edita una, hay que sincronizar la otra a mano (no
  hay build step que las una).
- `Lista nombres.txt` es un listado plano viejo (pre-categorización por
  instrumento), ya no lo usa la app — quedó como referencia.
- El servidor de desarrollo (`.claude/launch.json`, fuera de este repo)
  sirve `www/` en el puerto **420** (por el chiste del objetivo del
  juego). Los `<script src="...?v=2">` tienen un query de cache-busting
  porque el navegador de pruebas cacheaba agresivamente — subir ese
  número si se edita JS/CSS y no se ve reflejado.
- No hay build/CI configurado en este repo — todo el frontend es HTML
  plano sin bundler (ver `AGENTS.md` para las reglas puntuales de este
  ecosistema, especialmente las de Tauri/WebView2 y `localStorage`).
