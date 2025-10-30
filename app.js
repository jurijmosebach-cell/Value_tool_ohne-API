const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const teamInput = document.getElementById("team");

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

async function loadGames() {
  try {
    let url = "/api/games";
    if (dateInput.value) url += "?date=" + dateInput.value;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      gamesDiv.innerHTML = "<p>⚠️ Keine Spiele gefunden.</p>";
      return;
    }

    const games = data.response;
    const q = teamInput.value.toLowerCase();
    const filtered = q
      ? games.filter(
          (g) =>
            g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q)
        )
      : games;

    top3Div.innerHTML = "";
    filtered.slice(0, 3).forEach((g) => {
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})<br>
        ${new Date(g.date).toLocaleString()}
      `;
      div.appendChild(createBar("Home", g.value.home, "#16a34a"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      top3Div.appendChild(div);
    });

    gamesDiv.innerHTML = "";
    filtered.forEach((g) => {
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})<br>
        ${new Date(g.date).toLocaleString()}
      `;
      div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
      div.appendChild(createBar("Under 2.5", g.value.under25, "#8b5cf6"));
      gamesDiv.appendChild(div);
    });
  } catch (err) {
    gamesDiv.innerHTML = "<p>❌ Fehler beim Laden der Spiele.</p>";
    console.error(err);
  }
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
