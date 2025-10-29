const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
const teamInput = document.getElementById("team");

// Balken erstellen
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

// Farbe nach Value/Trend
function getTrafficColor(value, trend) {
  if (value > 0.15 && (trend === "home" || trend === "away")) return "#16a34a";
  if (value > 0) return "#f59e0b";
  return "#ef4444";
}

// Spiele laden & anzeigen
async function loadGames() {
  try {
    let url = "/api/games?refresh=true";
    if (dateInput.value) url += "&date=" + dateInput.value;

    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      gamesDiv.innerHTML = "<p>Fehler: keine Spieldaten erhalten.</p>";
      return;
    }

    let games = data.response.slice();

    // Filter Liga
    if (leagueSelect.value)
      games = games.filter((g) => g.league === leagueSelect.value);

    // Filter Team
    if (teamInput.value) {
      const q = teamInput.value.toLowerCase();
      games = games.filter(
        (g) =>
          g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q)
      );
    }

    // Sortiere nach Value (1X2)
    games.sort(
      (a, b) =>
        Math.max(b.value.home, b.value.draw, b.value.away) -
        Math.max(a.value.home, a.value.draw, a.value.away)
    );

    const topGames = games.slice(0, 3);
    const otherGames = games.slice(3);

    // Top 3 Spiele
    top3Div.innerHTML = "";
    topGames.forEach((g) => {
      g.btts = g.btts ?? 0;
      const div = document.createElement("div");
      div.className = "game top3";
      const dateObj = g.date ? new Date(g.date) : new Date();
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const color = getTrafficColor(bestVal, g.trend);
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) 
        - <span class="date">${dateObj.toLocaleString()}</span></div>
        <div class="team"><img src="${g.homeLogo}" alt=""> ${g.home} xG:${g.homeXG} | Trend:${g.trend}</div>
        <div class="team"><img src="${g.awayLogo}" alt=""> ${g.away} xG:${g.awayXG} | Trend:${g.trend}</div>
      `;
      div.appendChild(createBar("Home", g.prob?.home ?? g.value.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.prob?.draw ?? g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.prob?.away ?? g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.prob?.over25 ?? g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.prob ? (1 - g.prob.over25) : g.value.under25, "#8b5cf6"));
      div.appendChild(createBar("BTTS", g.btts ?? 0, "#ff7a00"));
      top3Div.appendChild(div);
    });

    // Top 7 Value
    top7ValueDiv.innerHTML = "";
    games.slice(0, 7).forEach((g) => {
      const div = document.createElement("div");
      div.className = "game";
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const color = getTrafficColor(bestVal, g.trend);
      div.style.borderLeft = `6px solid ${color}`;
      div.textContent = `${g.home} vs ${g.away} (${g.league}) → Value ${bestVal.toFixed(
        2
      )} | Trend: ${g.trend}`;
      top7ValueDiv.appendChild(div);
    });

    // Top 5 Over 2.5
    top5OverDiv.innerHTML = "";
    games
      .slice()
      .sort((a, b) => b.value.over25 - a.value.over25)
      .slice(0, 5)
      .forEach((g) => {
        const div = document.createElement("div");
        div.className = "game";
        div.style.borderLeft = `6px solid #2196f3`;
        div.textContent = `${g.home} vs ${g.away} (${g.league}) → Over2.5 ${
          g.prob?.over25 ?? g.value.over25
        } | Trend: ${g.trend}`;
        top5OverDiv.appendChild(div);
      });

    // Alle Spiele
    gamesDiv.innerHTML = "";
    otherGames.forEach((g) => {
      g.btts = g.btts ?? 0;
      const div = document.createElement("div");
      div.className = "game";
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const color = getTrafficColor(bestVal, g.trend);
      div.style.borderLeft = `6px solid ${color}`;
      const dateObj = g.date ? new Date(g.date) : new Date();
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) 
        - <span class="date">${dateObj.toLocaleString()}</span></div>
        <div class="team"><img src="${g.homeLogo}" alt=""> ${g.home} xG:${g.homeXG}</div>
        <div class="team"><img src="${g.awayLogo}" alt=""> ${g.away} xG:${g.awayXG}</div>
      `;
      div.appendChild(createBar("Home", g.prob?.home ?? g.value.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.prob?.draw ?? g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.prob?.away ?? g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.prob?.over25 ?? g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.prob ? (1 - g.prob.over25) : g.value.under25, "#8b5cf6"));
      div.appendChild(createBar("BTTS", g.btts ?? 0, "#ff7a00"));
      gamesDiv.appendChild(div);
    });

  } catch (err) {
    console.error("Fehler beim Laden:", err);
    gamesDiv.innerHTML = "<p>Fehler beim Laden der Spiele. Siehe Konsole.</p>";
  }
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
