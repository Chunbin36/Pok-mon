const API_BASE = "https://pokeapi.co/api/v2";
const KO_INDEX_STORAGE_KEY = "pokedex-ko-index-v1";

const LOCAL_KO_NAME_MAP = {
  bulbasaur: "이상해씨",
  ivysaur: "이상해풀",
  venusaur: "이상해꽃",
  charmander: "파이리",
  charmeleon: "리자드",
  charizard: "리자몽",
  squirtle: "꼬부기",
  wartortle: "어니부기",
  blastoise: "거북왕",
  caterpie: "캐터피",
  weedle: "뿔충이",
  pidgey: "구구",
  rattata: "꼬렛",
  pikachu: "피카츄",
  raichu: "라이츄",
  sandshrew: "모래두지",
  "nidoran-f": "니드런♀",
  "nidoran-m": "니드런♂",
  vulpix: "식스테일",
  jigglypuff: "푸린",
  zubat: "주뱃",
  oddish: "뚜벅초",
  diglett: "디그다",
  meowth: "나옹",
  psyduck: "고라파덕",
  growlithe: "가디",
  poliwag: "발챙이",
  abra: "캐이시",
  machop: "알통몬",
  bellsprout: "모다피",
  geodude: "꼬마돌",
  magnemite: "코일",
  gastly: "고오스",
  onix: "롱스톤",
  krabby: "킹크랩",
  voltorb: "찌리리공",
  exeggcute: "아라리",
  cubone: "탕구리",
  koffing: "또가스",
  rhyhorn: "뿔카노",
  horsea: "쏘드라",
  staryu: "별가사리",
  magikarp: "잉어킹",
  eevee: "이브이",
  snorlax: "잠만보",
  dratini: "미뇽",
  dragonite: "망나뇽",
  mewtwo: "뮤츠",
  mew: "뮤",
};

const ui = {
  introScreen: document.getElementById("introScreen"),
  enterButton: document.getElementById("enterButton"),
  appRoot: document.getElementById("appRoot"),
  pokedexShell: document.getElementById("pokedexShell"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  resetButton: document.getElementById("resetButton"),
  resultText: document.getElementById("resultText"),
  pokemonList: document.getElementById("pokemonList"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),
  mobileScrollControls: document.getElementById("mobileScrollControls"),
  scrollTopButton: document.getElementById("scrollTopButton"),
  scrollBottomButton: document.getElementById("scrollBottomButton"),
  detailDialog: document.getElementById("detailDialog"),
  detailContent: document.getElementById("detailContent"),
  closeDialog: document.getElementById("closeDialog"),
};

const state = {
  entered: false,
  page: 1,
  pageSize: 12,
  query: "",
  allIndex: [],
  filteredIndex: [],
  speciesCache: new Map(),
  typeKoCache: new Map(),
  abilityKoCache: new Map(),
  koNameById: new Map(),
  koIndexedUntil: 0,
  koIndexPromise: null,
};

const statKoMap = {
  hp: "HP",
  attack: "공격",
  defense: "방어",
  "special-attack": "특수공격",
  "special-defense": "특수방어",
  speed: "스피드",
};

ui.enterButton.addEventListener("click", async () => {
  if (state.entered) return;
  state.entered = true;

  ui.appRoot.classList.remove("hidden");
  requestAnimationFrame(() => {
    ui.appRoot.classList.add("visible");
    ui.pokedexShell.classList.add("open");
    ui.introScreen.classList.add("fade-out");
  });

  window.setTimeout(() => {
    ui.introScreen.classList.add("hidden");
    document.body.classList.remove("intro-active");
    ui.mobileScrollControls?.classList.remove("hidden");
  }, 520);

  await initializeDex();
});

ui.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.query = ui.searchInput.value.trim().toLowerCase();
  state.page = 1;
  await applySearchFilter();
  await renderCurrentPage();
});

ui.resetButton.addEventListener("click", async () => {
  ui.searchInput.value = "";
  state.query = "";
  state.page = 1;
  await applySearchFilter();
  await renderCurrentPage();
});

ui.prevPage.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await renderCurrentPage();
});

ui.nextPage.addEventListener("click", async () => {
  const total = getTotalPages();
  if (state.page >= total) return;
  state.page += 1;
  await renderCurrentPage();
});

ui.closeDialog.addEventListener("click", () => {
  if (typeof ui.detailDialog.close === "function") ui.detailDialog.close();
  else ui.detailDialog.removeAttribute("open");
});

ui.scrollTopButton?.addEventListener("click", () => {
  ui.appRoot.scrollTo({ top: 0, behavior: "smooth" });
});

ui.scrollBottomButton?.addEventListener("click", () => {
  ui.appRoot.scrollTo({ top: ui.appRoot.scrollHeight, behavior: "smooth" });
});

async function initializeDex() {
  try {
    setStatus("포켓몬 목록을 준비하는 중...");
    const response = await fetch(`${API_BASE}/pokemon?limit=1302`);
    if (!response.ok) throw new Error("목록을 불러오지 못했습니다.");
    const data = await response.json();
    state.allIndex = data.results.map((item) => ({
      name: item.name,
      id: parseId(item.url),
    }));

    hydrateKoIndexFromStorage();
    seedKoNameMap();
    await applySearchFilter();
    await renderCurrentPage();
    warmKoIndexInBackground();
  } catch (error) {
    setStatus(`오류: ${error.message}`);
  }
}

async function applySearchFilter() {
  const query = state.query;
  if (!query) {
    state.filteredIndex = [];
    return;
  }

  if (/^\d+$/.test(query)) {
    state.filteredIndex = state.allIndex.filter((pokemon) => String(pokemon.id).includes(query));
    return;
  }

  if (hasHangul(query)) {
    await ensureKoIndexForQuery(query);
    state.filteredIndex = state.allIndex.filter((pokemon) => {
      const koName = (state.koNameById.get(pokemon.id) || "").toLowerCase();
      return koName.includes(query);
    });
    return;
  }

  state.filteredIndex = state.allIndex.filter((pokemon) => pokemon.name.includes(query));
}

async function ensureKoIndexForQuery(query) {
  const currentMatchCount = countKoMatches(query);
  if (currentMatchCount > 0 || state.koIndexedUntil >= state.allIndex.length) return;

  setStatus("한글 검색 인덱스를 확장하는 중...");
  await expandKoIndexUntilMatch(query);
}

function countKoMatches(query) {
  let count = 0;
  for (const koName of state.koNameById.values()) {
    if (koName.toLowerCase().includes(query)) count += 1;
  }
  return count;
}

async function expandKoIndexUntilMatch(query) {
  if (state.koIndexPromise) {
    await state.koIndexPromise;
    return;
  }

  state.koIndexPromise = (async () => {
    while (state.koIndexedUntil < state.allIndex.length && countKoMatches(query) === 0) {
      await expandKoIndexBatch(40);
    }
  })();

  try {
    await state.koIndexPromise;
  } finally {
    state.koIndexPromise = null;
  }
}

async function expandKoIndexBatch(batchSize) {
  const start = state.koIndexedUntil;
  const batch = state.allIndex.slice(start, start + batchSize);
  if (!batch.length) return;

  const settled = await Promise.allSettled(batch.map((item) => getSpeciesInfo(item.id)));
  settled.forEach((result, idx) => {
    if (result.status !== "fulfilled") return;
    const koName = result.value.nameKo;
    if (!koName) return;
    const id = batch[idx].id;
    state.koNameById.set(id, koName);
  });

  state.koIndexedUntil += batch.length;
  persistKoIndexToStorage();
}

function warmKoIndexInBackground() {
  const task = async () => {
    if (!state.entered || state.koIndexedUntil >= state.allIndex.length || state.koIndexPromise) return;
    await expandKoIndexBatch(25);
    window.setTimeout(task, 250);
  };

  window.setTimeout(task, 1500);
}

function seedKoNameMap() {
  state.allIndex.forEach((pokemon) => {
    const ko = LOCAL_KO_NAME_MAP[pokemon.name];
    if (!ko) return;
    if (!state.koNameById.has(pokemon.id)) {
      state.koNameById.set(pokemon.id, ko);
    }
  });
}

function hydrateKoIndexFromStorage() {
  try {
    const raw = localStorage.getItem(KO_INDEX_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const namesById = parsed?.namesById || {};
    Object.entries(namesById).forEach(([id, koName]) => {
      if (typeof koName === "string" && koName) {
        state.koNameById.set(Number(id), koName);
      }
    });
    const storedUntil = Number(parsed?.indexedUntil || 0);
    if (Number.isFinite(storedUntil)) {
      state.koIndexedUntil = Math.min(Math.max(storedUntil, 0), state.allIndex.length);
    }
  } catch (_error) {
    state.koIndexedUntil = 0;
  }
}

function persistKoIndexToStorage() {
  try {
    const namesById = {};
    state.koNameById.forEach((value, key) => {
      namesById[key] = value;
    });
    localStorage.setItem(
      KO_INDEX_STORAGE_KEY,
      JSON.stringify({
        indexedUntil: state.koIndexedUntil,
        namesById,
      })
    );
  } catch (_error) {
    // localStorage 용량 제한 등은 검색 기능 핵심 동작에 영향이 없도록 무시.
  }
}

function hasHangul(text) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

async function renderCurrentPage() {
  const source = state.query ? state.filteredIndex : state.allIndex;
  const totalPages = getTotalPages();
  const safePage = Math.min(Math.max(state.page, 1), Math.max(totalPages, 1));
  state.page = safePage;

  const start = (state.page - 1) * state.pageSize;
  const slice = source.slice(start, start + state.pageSize);
  ui.pokemonList.innerHTML = "";

  if (!slice.length) {
    setStatus("검색 결과가 없습니다.");
    updatePagination();
    return;
  }

  setStatus("데이터를 불러오는 중...");
  const settled = await Promise.allSettled(slice.map((item) => getPokemonSummary(item.id)));
  const details = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
  details.forEach((pokemon) => ui.pokemonList.appendChild(createCard(pokemon)));

  if (!details.length) {
    setStatus("데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    updatePagination();
    return;
  }

  const totalCount = source.length;
  setStatus(`총 ${totalCount.toLocaleString("ko-KR")}마리 중 ${start + 1}~${Math.min(start + state.pageSize, totalCount)} 표시`);
  updatePagination();
}

function getTotalPages() {
  const source = state.query ? state.filteredIndex : state.allIndex;
  return Math.ceil(source.length / state.pageSize);
}

function updatePagination() {
  const total = Math.max(getTotalPages(), 1);
  ui.pageInfo.textContent = `${state.page} / ${total}`;
  ui.prevPage.disabled = state.page <= 1;
  ui.nextPage.disabled = state.page >= total;
}

function setStatus(message) {
  ui.resultText.textContent = message;
}

function parseId(url) {
  const parts = url.split("/").filter(Boolean);
  return Number(parts[parts.length - 1]);
}

async function getPokemonSummary(id) {
  const pokemonRes = await fetch(`${API_BASE}/pokemon/${id}`);
  if (!pokemonRes.ok) throw new Error("포켓몬 정보를 가져오지 못했습니다.");
  const pokemon = await pokemonRes.json();

  const speciesInfo = await getSpeciesInfo(pokemon.id);
  const typeNames = await Promise.all(pokemon.types.map((typeItem) => getTypeKo(typeItem.type.url)));

  return {
    id: pokemon.id,
    nameKo: speciesInfo.nameKo || state.koNameById.get(pokemon.id) || pokemon.name,
    nameEn: pokemon.name,
    image:
      pokemon.sprites.other["official-artwork"].front_default ||
      pokemon.sprites.front_default ||
      "",
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    types: typeNames,
    stats: pokemon.stats,
    abilities: pokemon.abilities,
    flavor: speciesInfo.flavor,
    genus: speciesInfo.genus,
  };
}

async function getSpeciesInfo(id) {
  if (state.speciesCache.has(id)) return state.speciesCache.get(id);

  const speciesRes = await fetch(`${API_BASE}/pokemon-species/${id}`);
  if (!speciesRes.ok) {
    const fallback = { nameKo: state.koNameById.get(id) || "", genus: "-", flavor: "설명이 없습니다." };
    state.speciesCache.set(id, fallback);
    return fallback;
  }

  const species = await speciesRes.json();
  const nameKo = species.names.find((item) => item.language.name === "ko")?.name || state.koNameById.get(id) || "";
  const genus = species.genera.find((item) => item.language.name === "ko")?.genus || "-";
  const flavor =
    species.flavor_text_entries.find((item) => item.language.name === "ko")?.flavor_text.replace(/\s+/g, " ") ||
    "도감 설명이 없습니다.";

  if (nameKo) state.koNameById.set(id, nameKo);

  const payload = { nameKo, genus, flavor };
  state.speciesCache.set(id, payload);
  return payload;
}

async function getTypeKo(typeUrl) {
  if (state.typeKoCache.has(typeUrl)) return state.typeKoCache.get(typeUrl);

  const typeRes = await fetch(typeUrl);
  if (!typeRes.ok) return "타입";
  const type = await typeRes.json();
  const ko = type.names.find((item) => item.language.name === "ko")?.name || type.name;
  state.typeKoCache.set(typeUrl, ko);
  return ko;
}

async function getAbilityKo(abilityUrl) {
  if (state.abilityKoCache.has(abilityUrl)) return state.abilityKoCache.get(abilityUrl);

  const abilityRes = await fetch(abilityUrl);
  if (!abilityRes.ok) return "특성";
  const ability = await abilityRes.json();
  const ko = ability.names.find((item) => item.language.name === "ko")?.name || ability.name;
  state.abilityKoCache.set(abilityUrl, ko);
  return ko;
}

function createCard(pokemon) {
  const card = document.createElement("article");
  card.className = "pokemon-card";
  card.innerHTML = `
    <img src="${pokemon.image}" alt="${pokemon.nameKo}" loading="lazy" />
    <span class="pokemon-id">No.${String(pokemon.id).padStart(4, "0")}</span>
    <h2 class="pokemon-name">${pokemon.nameKo}</h2>
    <div class="type-wrap">
      ${pokemon.types.map((type) => `<span class="type-chip">${type}</span>`).join("")}
    </div>
    <p class="meta">키 ${pokemon.height}m · 몸무게 ${pokemon.weight}kg</p>
  `;
  card.addEventListener("click", () => openDetailDialog(pokemon));
  return card;
}

async function openDetailDialog(pokemon) {
  const abilityNames = await Promise.all(
    pokemon.abilities.map((item) => getAbilityKo(item.ability.url).then((ko) => (item.is_hidden ? `${ko} (숨겨진 특성)` : ko)))
  );

  const statsHtml = pokemon.stats
    .map((stat) => `<div>${statKoMap[stat.stat.name] || stat.stat.name}: <strong>${stat.base_stat}</strong></div>`)
    .join("");

  ui.detailContent.innerHTML = `
    <h2>${pokemon.nameKo} <small>(No.${String(pokemon.id).padStart(4, "0")})</small></h2>
    <p><strong>분류:</strong> ${pokemon.genus}</p>
    <p><strong>타입:</strong> ${pokemon.types.join(", ")}</p>
    <p><strong>특성:</strong> ${abilityNames.join(", ")}</p>
    <p><strong>도감 설명:</strong> ${pokemon.flavor}</p>
    <h3>능력치</h3>
    <div class="stats-grid">${statsHtml}</div>
  `;

  if (typeof ui.detailDialog.showModal === "function") {
    ui.detailDialog.showModal();
  } else {
    ui.detailDialog.setAttribute("open", "true");
  }
}
