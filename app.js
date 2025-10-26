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

function renderGamesTable(games, container) {
  container.innerHTML = "";

  games.forEach(g => {
    const row = document.createElement("div");
    row.className = "game-row";

    row.innerHTML = `
      <div class="team">
        <img src="${g.homeLogo}" alt="${g.home}" /> ${g.home}
      </div>
      <div class="team">
        <img src="${g.awayLogo}" alt="${g.away}" /> ${g.away}
      </div>
      <div class="league">${g.league}</div>
      <div class="xg">xG: ${g.homeXG} - ${g.awayXG}</div>
      <div class="value">Value: H:${g.value.home} D:${g.value.draw} A:${g.value.away}</div>
      <div class="trend">Trend: ${g.trend}</div>
    `;
    container.appendChild(row);
  });
}

async function init() {
  const container = document.getElementById("games-container");
  const topContainer = document.getElementById("top-games-container");

  const allGames = await fetchGames();
  const topGames = await fetchTopGames();

  // Top-Spiele anzeigen
  const topCombined = [...topGames.topValue, ...topGames.topOver];
  const seen = new Set();
  const uniqueTop = topCombined.filter(g => {
    if(seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  renderGamesTable(uniqueTop, topContainer);

  // Alle Spiele darunter
  renderGamesTable(allGames, container);
}

init();
setInterval(init, 15*60*1000); // alle 15 Minuten aktualisieren
