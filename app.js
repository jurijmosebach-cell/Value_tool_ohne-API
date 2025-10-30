const top3Div = document.getElementById("top3");
const gamesDiv = document.getElementById("games");
const dateInput = document.getElementById("date");
const loadBtn = document.getElementById("loadBtn");

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
  if (value > 0.6 && (trend === "home" || trend === "away")) return "#16a34a";
  if (value > 0.45) return "#f59e0b";
  return "#ef4444";
}

async function loadGames() {
  try {
    const date = dateInput.value || new Date().toISOString().split("T")[0];
    const res = await fetch(`/api/games?date=${date}`);
    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      gamesDiv.innerHTML = "<p>Keine Spieldaten gefunden.</p>";
      return;
    }

    const games = data.response.sort(
      (a, b) =>
        Math.max(b.value.home, b.value.draw, b.value.away) -
        Math.max(a.value.home, a.value.draw, a.value.away)
    );

    // Top 3
    top3Div.innerHTML = "";
    games.slice(0, 3).forEach((g) => {
      const color = getTrafficColor(
        Math.max(g.value.home, g.value.draw, g.value.away),
        g.trend
      );
      const div = document.createElement("div");
      div.className = "game top3";
      div.style.borderLeft = `6px solid ${color}`;
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})</div>
        <div>xG: ${g.homeXG.toFixed(2)} - ${g.awayXG.toFixed(2)} | Trend: ${g.trend}</div>
      `;
      div.appendChild(createBar("Home", g.prob.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.prob.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.prob.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.prob.over25, "#2196f3"));
      div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
      top3Div.appendChild(div);
    });

    // Alle Spiele
    gamesDiv.innerHTML = "";
    games.forEach((g) => {
      const color = getTrafficColor(
        Math.max(g.value.home, g.value.draw, g.value.away),
        g.trend
      );
      const div = document.createElement("div");
      div.className = "game";
      div.style.borderLeft = `5px solid ${color}`;
      div.innerHTML = `
        <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})</div>
        <div>xG: ${g.homeXG.toFixed(2)} - ${g.awayXG.toFixed(2)} | Trend: ${g.trend}</div>
      `;
      div.appendChild(createBar("Home", g.prob.home, "#4caf50"));
      div.appendChild(createBar("Draw", g.prob.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.prob.away, "#ef4444"));
      div.appendChild(createBar("Over 2.5", g.prob.over25, "#2196f3"));
      div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
      gamesDiv.appendChild(div);
    });
  } catch (err) {
    console.error("Fehler:", err);
    gamesDiv.innerHTML = "<p>Fehler beim Laden der Spiele.</p>";
  }
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
