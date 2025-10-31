// ==== HTML-Elemente holen ====
const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
const teamInput = document.getElementById("team");

// ==== Hilfsfunktionen ====
function createBar(label, value, color) {
  const wrap = document.createElement("div");
  wrap.className = "bar-container";
  const bar = document.createElement("div");
  bar.className = "bar";
  const pct = Math.round((value || 0) * 100);
  bar.style.width = `${pct}%`;
  bar.style.background = color;
  bar.textContent = `${label} ${pct}%`;
  wrap.appendChild(bar);
  return wrap;
}

function getTrafficColor(value, trend) {
  if (value > 0.15 && trend === "home") return "#16a34a";
  if (value > 0.15 && trend === "away") return "#3b82f6";
  if (value > 0.1) return "#f59e0b";
  return "#ef4444";
}

// ==== Spiele laden & anzeigen ====
async function loadGames() {
  try {
    let url = "/api/games";
    if (dateInput.value) url += `?date=${dateInput.value}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      gamesDiv.innerHTML = "<p>❌ Keine Daten erhalten.</p>";
      return;
    }

    let games = data.response.slice();

    // Filter Liga
    if (leagueSelect.value) {
      games = games.filter((g) => g.league === leagueSelect.value);
    }

    // Filter Team
    if (teamInput.value) {
      const q = teamInput.value.toLowerCase();
      games = games.filter(
        (g) =>
          g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q)
      );
    }

    // Sortieren nach Value
    games.sort(
      (a, b) =>
        Math.max(b.value.home, b.value.draw, b.value.away) -
        Math.max(a.value.home, a.value.draw, a.value.away)
    );

    // ==== TOP 3 ====
    const top3 = games.slice(0, 3);
    top3Div.innerHTML = "<h3>🏆 Top 3 Spiele</h3>";
    top3.forEach((g) => {
      const div = document.createElement("div");
      div.className = "game top3";
      const color = getTrafficColor(Math.max(g.value.home, g.value.draw, g.value.away), g.trend);
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <img class="game-logo" src="${g.homeLogo}" alt="${g.home}" />
        <div class="game-info">
          <strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})<br/>
          <small>${new Date(g.date).toLocaleString()}</small>
        </div>
        <img class="game-logo" src="${g.awayLogo}" alt="${g.away}" />
      `;
      div.appendChild(createBar("Home", g.value.home, "#16a34a"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
      div.appendChild(createBar("BTTS", g.btts ?? 0, "#ff7a00"));
      top3Div.appendChild(div);
    });

    // ==== TOP 7 Value ====
    const top7 = games.slice(0, 7);
    top7ValueDiv.innerHTML = "<h3>💰 Top 7 Value</h3>";
    top7.forEach((g) => {
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = `6px solid ${getTrafficColor(bestVal, g.trend)}`;
      div.innerHTML = `
        <img class="game-logo" src="${g.homeLogo}" alt="${g.home}" />
        <div class="game-info">
          ${g.home} vs ${g.away} (${g.league}) → Value ${(bestVal * 100).toFixed(1)}% | Trend: ${g.trend}
        </div>
        <img class="game-logo" src="${g.awayLogo}" alt="${g.away}" />
      `;
      top7ValueDiv.appendChild(div);
    });

    // ==== TOP 5 Over 2.5 ====
    const top5Over = games
      .slice()
      .sort((a, b) => b.value.over25 - a.value.over25)
      .slice(0, 5);
    top5OverDiv.innerHTML = "<h3>⚽ Top 5 Over 2.5</h3>";
    top5Over.forEach((g) => {
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = "6px solid #2196f3";
      div.innerHTML = `
        <img class="game-logo" src="${g.homeLogo}" alt="${g.home}" />
        <div class="game-info">
          ${g.home} vs ${g.away} (${g.league}) → ${(g.value.over25 * 100).toFixed(1)}% Over 2.5
        </div>
        <img class="game-logo" src="${g.awayLogo}" alt="${g.away}" />
      `;
      top5OverDiv.appendChild(div);
    });

    // ==== Alle Spiele ====
    gamesDiv.innerHTML = "<h3>📋 Alle Spiele</h3>";
    games.forEach((g) => {
      const div = document.createElement("div");
      div.className = "game";
      const color = getTrafficColor(Math.max(g.value.home, g.value.draw, g.value.away), g.trend);
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <img class="game-logo" src="${g.homeLogo}" alt="${g.home}" />
        <div class="game-info">
          <strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})<br/>
          <small>${new Date(g.date).toLocaleString()}</small>
        </div>
        <img class="game-logo" src="${g.awayLogo}" alt="${g.away}" />
      `;
      div.appendChild(createBar("Home", g.value.home, "#16a34a"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.value.under25, "#8b5cf6"));
      div.appendChild(createBar("BTTS", g.btts ?? 0, "#ff7a00"));
      gamesDiv.appendChild(div);
    });

  } catch (err) {
    console.error("❌ Fehler beim Laden:", err);
    gamesDiv.innerHTML = `<p>❌ Fehler beim Laden der Spiele. (${err.message})</p>`;
  }
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
