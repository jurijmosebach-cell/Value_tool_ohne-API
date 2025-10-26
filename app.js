const API_URL = "/api/games";

async function fetchGames() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return data.response || [];
}

async function fetchTopGames() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return {
    topValue: data.top7Value || [],
    topOver: data.top5Over25 || []
  };
}

function createBar(value, label, color) {
  const barWrapper = document.createElement("div");
  barWrapper.className = "value-bar-wrapper";

  const bar = document.createElement("div");
  bar.className = "value-bar";
  bar.style.width = `${Math.min(Math.abs(value)*50, 100)}%`; // max 100%
  bar.style.backgroundColor = color;

  const text = document.createElement("span");
  text.className = "bar-label";
  text.textContent = `${label}: ${value}`;

  barWrapper.appendChild(bar);
  barWrapper.appendChild(text);
  return barWrapper;
}

function renderGamesTable(games, container) {
  container.innerHTML = "";

  games.forEach(g => {
    const row = document.createElement("div");
    row.className = "game-row";

    row.innerHTML = `
      <div class="team"><img src="${g.homeLogo}" alt="${g.home}" /> ${g.home}</div>
      <div class="team"><img src="${g.awayLogo}" alt="${g.away}" /> ${g.away}</div>
      <div class="league">${g.league}</div>
      <div class="trend">Trend: ${g.trend}</div>
      <div class="bars"></div>
    `;

    const barsContainer = row.querySelector(".bars");
    barsContainer.appendChild(createBar(g.value.home, "H", g.value.home>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.draw, "D", g.value.draw>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.away, "A", g.value.away>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.over25, "O2.5", g.value.over25>=0?"#2196f3":"#f44336"));
    barsContainer.appendChild(createBar(g.value.under25, "U2.5", g.value.under25>=0?"#2196f3":"#f44336"));

    container.appendChild(row);
  });
}

async function init() {
  const container = document.getElementById("games-container");
  const topContainer = document.getElementById("top-games-container");

  const allGames = await fetchGames();
  const topGames = await fetchTopGames();

  // Top-Spiele oben
  const topCombined = [...topGames.topValue, ...topGames.topOver];
  const seen = new Set();
  const uniqueTop = topCombined.filter(g => {
    if(seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  renderGamesTable(uniqueTop, topContainer);
  renderGamesTable(allGames, container);
}

init();
setInterval(init, 15*60*1000);
