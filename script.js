const LEGS = [
  { num: 1,  dist: 1100, from: 'Knud Knudsens plass', to: 'Louises gate',         type: 'hilly',    note: 'Kupert start på løpet.' },
  { num: 2,  dist: 1070, from: 'Louises gate',         to: 'Wolffs gate',          type: 'climb',    note: 'Bratt stigning — for de tøffe.' },
  { num: 3,  dist: 595,  from: 'Wolffs gate',          to: 'Wilhelm Færdens vei',  type: 'flat',     note: 'Kort og flatt — perfekt for nybegynnere.' },
  { num: 4,  dist: 1920, from: 'Wilhelm Færdens vei',  to: 'Forskningsveien',      type: 'hilly',    note: 'Lang etappe med blandet terreng.' },
  { num: 5,  dist: 1210, from: 'Forskningsveien',      to: 'Holmenveien',          type: 'hilly',    note: 'Varierte bakker.' },
  { num: 6,  dist: 1250, from: 'Holmenveien',          to: 'Slemdal skole',        type: 'climb',    note: 'Betydelig motbakke.' },
  { num: 7,  dist: 1770, from: 'Slemdal skole',        to: 'Besserud',             type: 'climb',    note: 'Bratt stigning — den tøffeste etappen.' },
  { num: 8,  dist: 1780, from: 'Besserud',             to: 'Gressbanen',           type: 'downhill', note: 'Nedover hele veien — herlig!' },
  { num: 9,  dist: 625,  from: 'Gressbanen',           to: 'Holmendammen',         type: 'downhill', note: 'Kort nedoverbakke.' },
  { num: 10, dist: 2860, from: 'Holmendammen',         to: 'Frognerparken',        type: 'downhill', note: 'Den lengste etappen — nedover hele veien.' },
  { num: 11, dist: 1520, from: 'Frognerparken',        to: 'Nordraaks gate',       type: 'hilly',    note: 'Gjennom parken med blandet terreng.' },
  { num: 12, dist: 350,  from: 'Nordraaks gate',       to: 'Arno Bergs plass',     type: 'flat',     note: 'Den korteste etappen — flatt.' },
  { num: 13, dist: 1080, from: 'Arno Bergs plass',     to: 'Camilla Collets vei',  type: 'climb',    note: 'Lett stigning.' },
  { num: 14, dist: 710,  from: 'Camilla Collets vei',  to: 'Bislettgata',          type: 'flat',     note: 'Flat etappe inn mot mål.' },
  { num: 15, dist: 535,  from: 'Bislettgata',          to: 'Bislett Stadion',      type: 'flat',     note: 'Siste runde på Bislett — æresetappen!' },
];

const TYPE_LABEL = {
  flat: 'Flatt',
  climb: 'Motbakke',
  downhill: 'Nedover',
  hilly: 'Kupert',
};

const STORAGE_KEY = 'holmenkoll-wishes-2026';
const NAME_KEY = 'holmenkoll-my-name-2026';

// ----- Storage backend: Supabase if configured, otherwise localStorage -----
const cfg = window.SUPABASE_CONFIG || {};
const useSupabase = !!(cfg.url && cfg.anonKey && window.supabase);
const supa = useSupabase ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

// picks shape: { [legNum]: [{ id, name, picked_at }] }
let picks = {};
let currentFilter = 'all';
let lengthSort = 'off'; // 'off' | 'asc' (kortest først) | 'desc' (lengst først)
let pendingLeg = null;
let nextLocalId = 1;

async function loadPicks() {
  if (useSupabase) {
    const { data, error } = await supa
      .from('picks')
      .select('id, leg_num, runner_name, picked_at')
      .order('picked_at', { ascending: true });
    if (error) {
      console.error('Supabase load failed, using localStorage fallback:', error);
      return loadFromLocal();
    }
    const map = {};
    data.forEach((row) => {
      if (!map[row.leg_num]) map[row.leg_num] = [];
      map[row.leg_num].push({ id: row.id, name: row.runner_name, picked_at: row.picked_at });
    });
    return map;
  }
  return loadFromLocal();
}

function loadFromLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    // bump nextLocalId past anything stored
    Object.values(raw).flat().forEach((w) => {
      if (typeof w.id === 'number' && w.id >= nextLocalId) nextLocalId = w.id + 1;
    });
    return raw;
  } catch { return {}; }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
}

async function addWish(legNum, name) {
  // Prevent duplicate (same person, same leg)
  const existing = picks[legNum] || [];
  if (existing.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
    alert(`${name} ønsker allerede etappe ${legNum}.`);
    return false;
  }

  if (useSupabase) {
    const { data, error } = await supa
      .from('picks')
      .insert({ leg_num: legNum, runner_name: name })
      .select('id, picked_at')
      .single();
    if (error) { alert('Kunne ikke lagre ønsket: ' + error.message); return false; }
    picks[legNum] = [...existing, { id: data.id, name, picked_at: data.picked_at }];
  } else {
    const id = nextLocalId++;
    picks[legNum] = [...existing, { id, name, picked_at: new Date().toISOString() }];
    persistLocal();
  }
  return true;
}

async function removeWish(legNum, wishId) {
  if (useSupabase) {
    const { error } = await supa.from('picks').delete().eq('id', wishId);
    if (error) { alert('Kunne ikke fjerne ønsket: ' + error.message); return false; }
  }
  picks[legNum] = (picks[legNum] || []).filter((w) => w.id !== wishId);
  if (picks[legNum].length === 0) delete picks[legNum];
  if (!useSupabase) persistLocal();
  return true;
}

async function resetAll() {
  if (useSupabase) {
    const { error } = await supa.from('picks').delete().gte('leg_num', 1);
    if (error) { alert('Kunne ikke nullstille: ' + error.message); return; }
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  picks = {};
}

function formatDistance(m) {
  if (m >= 1000) return (m / 1000).toFixed(2).replace('.', ',') + ' km';
  return m + ' m';
}

function getMyName() {
  return localStorage.getItem(NAME_KEY) || '';
}

function setMyName(name) {
  localStorage.setItem(NAME_KEY, name);
}

function render() {
  const container = document.getElementById('legs');
  container.innerHTML = '';

  const filtered = LEGS.filter((leg) => {
    const wishes = picks[leg.num] || [];
    if (currentFilter === 'all') return true;
    if (currentFilter === 'no-wishes') return wishes.length === 0;
    return leg.type === currentFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (lengthSort === 'asc') return a.dist - b.dist;
    if (lengthSort === 'desc') return b.dist - a.dist;
    return a.num - b.num;
  });

  sorted.forEach((leg) => {
    const wishes = picks[leg.num] || [];
    const card = document.createElement('div');
    card.className = 'leg-card';

    card.innerHTML = `
      <div class="leg-header">
        <div class="leg-number">${leg.num}</div>
        <div class="leg-distance">
          <strong>${formatDistance(leg.dist)}</strong>
          ${leg.dist} m
        </div>
      </div>
      <span class="leg-tag ${leg.type}">${TYPE_LABEL[leg.type]}</span>
      <div class="leg-route">
        <strong>${leg.from}</strong><br>
        ↓<br>
        <strong>${leg.to}</strong>
      </div>
      <p class="leg-note">${leg.note}</p>
      <div class="leg-wishes">
        <div class="wishes-label">${
          wishes.length === 0
            ? 'Ingen ønsker enda'
            : wishes.length === 1 ? '1 ønske' : `${wishes.length} ønsker`
        }</div>
        <div class="wish-chips">
          ${wishes.map((w) => `
            <span class="wish-chip" data-wish-id="${w.id}" data-leg="${leg.num}">
              ${escapeHtml(w.name)}
              <button class="wish-remove" aria-label="Fjern ${escapeHtml(w.name)}" title="Fjern dette ønsket">×</button>
            </span>
          `).join('')}
        </div>
      </div>
      <button class="wish-add">+ Ønsk deg denne</button>
    `;

    card.querySelector('.wish-add').addEventListener('click', (e) => {
      e.stopPropagation();
      openDialog(leg);
    });

    card.querySelectorAll('.wish-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chip = btn.closest('.wish-chip');
        const wishId = chip.dataset.wishId;
        const legNum = parseInt(chip.dataset.leg, 10);
        const wish = (picks[legNum] || []).find((w) => String(w.id) === String(wishId));
        if (!wish) return;
        if (confirm(`Fjerne ønsket fra ${wish.name} på etappe ${legNum}?`)) {
          await removeWish(legNum, wish.id);
          render();
        }
      });
    });

    container.appendChild(card);
  });
}

function openDialog(leg) {
  pendingLeg = leg;
  document.getElementById('dialog-leg-num').textContent = leg.num;
  document.getElementById('dialog-leg-desc').textContent =
    `${formatDistance(leg.dist)} fra ${leg.from} til ${leg.to}. ${leg.note}`;
  const input = document.getElementById('runner-name');
  input.value = getMyName();
  document.getElementById('pick-dialog').showModal();
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Filter chips
document.querySelectorAll('.filter[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter[data-filter]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// Length sort chip — toggles off → kortest først → lengst først → off
document.getElementById('sort-length').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (lengthSort === 'off') lengthSort = 'asc';
  else if (lengthSort === 'asc') lengthSort = 'desc';
  else lengthSort = 'off';

  btn.classList.toggle('active', lengthSort !== 'off');
  btn.classList.toggle('desc', lengthSort === 'desc');
  btn.setAttribute('aria-pressed', lengthSort !== 'off');
  btn.title =
    lengthSort === 'asc'  ? 'Sortert: kortest først (klikk for lengst først)' :
    lengthSort === 'desc' ? 'Sortert: lengst først (klikk for å nullstille)' :
                            'Sorter etter lengde';
  render();
});

document.querySelector('#pick-dialog form').addEventListener('submit', async (e) => {
  const name = document.getElementById('runner-name').value.trim();
  if (name && pendingLeg) {
    setMyName(name);
    const ok = await addWish(pendingLeg.num, name);
    if (ok) render();
  }
});

document.getElementById('cancel').addEventListener('click', () => {
  document.getElementById('pick-dialog').close();
});

// Live sync — when anyone adds or removes a wish, all browsers update.
function subscribeRealtime() {
  if (!useSupabase) return;
  supa
    .channel('picks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, async () => {
      picks = await loadPicks();
      render();
    })
    .subscribe();
}

// Boot
(async () => {
  picks = await loadPicks();
  render();
  subscribeRealtime();

  // Show storage mode in footer
  const mode = document.createElement('span');
  mode.style.cssText = 'display:block;margin-top:8px;font-size:11px;opacity:0.6;';
  mode.textContent = useSupabase
    ? '✓ Synkronisert via Supabase'
    : '⚠ Lokal lagring (kun denne nettleseren) — fyll inn config.js for å dele med kollegene';
  document.querySelector('footer').prepend(mode);
})();
