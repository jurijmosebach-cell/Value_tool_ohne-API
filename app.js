const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
const teamInput = document.getElementById("team");

// 🟢 Balken erstellen
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

// 🟡 Farbe bestimmen nach Value/Trend
function getTrafficColor(value, trend) {
  if (value > 0.7 && (trend === 'home' || trend === 'away')) return '#16a34a';
  if (value > 0.5) return '#f59e0b';
  return '#ef4444';
}

// 🔵 Hauptfunktion: Spiele laden
async function loadGames() {
  try {
    let url = "/api/games";
    if (dateInput.value) url += "?date=" + dateInput.value;

    console.log("📅 Lade Spiele von:", url);

    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      gamesDiv.innerHTML = "<p>⚠️ Keine Spieldaten erhalten.</p>";
      return;
    }

    let games = data.response.slice();

    // 🏆 Filter: Liga
    if (leagueSelect.value) {
      games = games.filter(g => g.league === leagueSelect.value);
    }

    // ⚽ Filter: Teamname
    if (teamInput.value) {
      const q = teamInput.value.toLowerCase();
      games = games.filter(g =>
        g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q)
      );
    }

    // 🔢 Sortiere nach Value
    games.sort(
      (a, b) =>
        Math.max(b.value.home, b.value.draw, b.value.away) -
        Math.max(a.value.home, a.value.draw, a.value.away)
    );

    const topGames = games.slice(0, 3);
    const top7 = games.slice(0, 7);
    const top5Over = games
      .slice()
      .sort((a, b) => b.value.over25 - a.value.over25)
      .slice(0, 5);
    const others = games.slice(3);

    // 🔝 TOP 3 SPIELE
    top3Div.innerHTML = "";
    topGames.forEach(g => {
      const div = document.createElement("div");
      div.className = "game top3";
      const color = getTrafficColor(
        Math.max(g.value.home, g.value.draw, g.value.away),
        g.trend
      );
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - 
        <span class="date">${new Date(g.date).toLocaleString()}</span></div>
        <div class="team"><img src="${g.homeLogo}" alt=""> ${g.home} xG:${g.homeXG}</div>
        <div class="team"><img src="${g.awayLogo}" alt=""> ${g.away} xG:${g.awayXG}</div>
      `;
      div.appendChild(createBar("Home", g.value.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.value.under25, "#8b5cf6"));
      div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
      top3Div.appendChild(div);
    });

    // 💰 TOP 7 VALUE SPIELE
    top7ValueDiv.innerHTML = "";
    top7.forEach(g => {
      const color = getTrafficColor(
        Math.max(g.value.home, g.value.draw, g.value.away),
        g.trend
      );
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = `6px solid ${color}`;
      div.textContent = `${g.home} vs ${g.away} (${g.league}) → Value ${(Math.max(
        g.value.home,
        g.value.draw,
        g.value.away
      )).toFixed(2)} | Trend: ${g.trend}`;
      top7ValueDiv.appendChild(div);
    });

    // 🔵 TOP 5 OVER 2.5 SPIELE
    top5OverDiv.innerHTML = "";
    top5Over.forEach(g => {
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = `6px solid #2196f3`;
      div.textContent = `${g.home} vs ${g.away} (${g.league}) → Over2.5 ${g.value.over25}`;
      top5OverDiv.appendChild(div);
    });

    // ⚙️ RESTLICHE SPIELE
    gamesDiv.innerHTML = "";
    others.forEach(g => {
      const color = getTrafficColor(
        Math.max(g.value.home, g.value.draw, g.value.away),
        g.trend
      );
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - 
        <span class="date">${new Date(g.date).toLocaleString()}</span></div>
        <div class="team"><img src="${g.homeLogo}" alt=""> ${g.home} xG:${g.homeXG}</div>
        <div class="team"><img src="${g.awayLogo}" alt=""> ${g.away} xG:${g.awayXG}</div>
      `;
      div.appendChild(createBar("Home", g.value.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.value.under25, "#8b5cf6"));
      div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
      gamesDiv.appendChild(div);
    });

  } catch (err) {
    console.error("❌ Fehler beim Laden:", err);
    gamesDiv.innerHTML = "<p>❌ Fehler beim Laden der Spiele. Siehe Konsole.</p>";
  }
}

// 🔁 Event Listeners
loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", () => {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  loadGames();
});
