// app.js
async function fetchGames() {
  try {
    const res = await fetch("/api/games");
    const json = await res.json();
    return json.response || [];
  } catch (err) {
    console.error("Fehler beim Laden der Spiele:", err);
    return [];
  }
}

function createBar(value, maxWidth = 120) {
  const positive = value > 0;
  const width = Math.min(maxWidth, Math.abs(value) * 30); // scale factor
  const bar = document.createElement("div");
  bar.className = "value-bar";
  bar.style.width = `${width}px`;
  bar.style.backgroundColor = positive ? "#16a34a" : "#ef4444";
  bar.textContent = `${value}`;
  return bar;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function renderGames(games) {
  const container = document.getElementById("games");
  container.innerHTML = "";
  if (!games.length) {
    container.innerHTML = "<p class='muted'>Keine Spiele gefunden.</p>";
    return;
  }

  games.forEach(g => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="row top">
        <div class="team">
          <img src="${g.homeLogo}" alt="" class="logo">
          <div class="team-name">${g.home}</div>
        </div>
        <div class="meta">
          <div class="league">${g.league}</div>
          <div class="date">${formatDate(g.utcDate)}</div>
        </div>
        <div class="team away">
          <img src="${g.awayLogo}" alt="" class="logo">
          <div class="team-name">${g.away}</div>
        </div>
      </div>

      <div class="row stats">
        <div class="xg">
          <div>xG: <strong>${g.homeXG}</strong> — <strong>${g.awayXG}</strong></div>
          <div class="xg-bars">
            <div class="bar-wrap"><div class="bar" style="width:${Math.min(120, g.homeXG*40)}px"></div></div>
            <div class="bar-wrap"><div class="bar alt" style="width:${Math.min(120, g.awayXG*40)}px"></div></div>
          </div>
        </div>

        <div class="values">
          <div>Value (Home):</div>
          <div class="value-row" id="val-${g.id}">
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    const vWrap = card.querySelector(`#val-${g.id}`);
    const homeVal = createBar(g.value.home);
    homeVal.title = `Home value ${g.value.home}`;
    vWrap.appendChild(homeVal);
  });
}

async function init() {
  const games = await fetchGames();
  renderGames(games);
}

// Refresh button
document.addEventListener("DOMContentLoaded", () => {
  init();
  const btn = document.getElementById("refresh");
  btn.addEventListener("click", () => {
    btn.classList.add("loading");
    init().finally(()=>btn.classList.remove("loading"));
  });
});
