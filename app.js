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
  bar.textContent = `${label}: ${pct}%`;
  wrap.appendChild(bar);
  return wrap;
}

async function loadGames() {
  try {
    const date = dateInput.value || new Date().toISOString().split("T")[0];
    const res = await fetch(`/api/games?date=${date}`);
    const data = await res.json();

    if (!data.response || !data.response.length) {
      gamesDiv.innerHTML = "<p>Keine Spiele gefunden.</p>";
      return;
    }

    let games = data.response;
    if (teamInput.value) {
      const q = teamInput.value.toLowerCase();
      games = games.filter(
        g => g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q)
      );
    }

    // Sortieren nach Value
    games.sort((a, b) => Math.max(b.value.home, b.value.draw, b.value.away) -
                        Math.max(a.value.home, a.value.draw, a.value.away));

    // Top 3
    top3Div.innerHTML = "";
    games.slice(0, 3).forEach(g => {
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `<strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})`;
      div.appendChild(createBar("Home", g.value.home, "#16a34a"));
      div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
      div.appendChild(createBar("Away", g.value.away, "#ef4444"));
      top3Div.appendChild(div);
    });

    // Top 7 Value
    top7ValueDiv.innerHTML = "";
    games.slice(0, 7).forEach(g => {
      const div = document.createElement("div");
      div.className = "game";
      div.textContent = `${g.home} vs ${g.away} → Value: ${(
        Math.max(g.value.home, g.value.draw, g.value.away)
      ).toFixed(2)}`;
      top7ValueDiv.appendChild(div);
    });

    // Top 5 Over 2.5
    top5OverDiv.innerHTML = "";
    games.slice()
      .sort((a, b) => b.value.over25 - a.value.over25)
      .slice(0, 5)
      .forEach(g => {
        const div = document.createElement("div");
        div.className = "game";
        div.textContent = `${g.home} vs ${g.away} → Over2.5: ${(
          g.value.over25 * 100
        ).toFixed(1)}%`;
        top5OverDiv.appendChild(div);
      });

    // Alle Spiele
    gamesDiv.innerHTML = "";
    games.forEach(g => {
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `<strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league})`;
      gamesDiv.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    gamesDiv.innerHTML = "<p>Fehler beim Laden der Spiele.</p>";
  }
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
