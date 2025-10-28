const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
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

function getTrafficColor(value, trend) {
  if (value > 0.15 && (trend === "home" || trend === "away")) return "#16a34a"; // stark grün
  if (value > 0) return "#f59e0b"; // gelb
  return "#ef4444"; // rot
}

async function loadGames() {
  try {
    let url = "/api/games";
    if (dateInput.value) url += "?date=" + dateInput.value;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Fehler beim Abrufen der Spieldaten: ${res.status} ${res.statusText}`);
      gamesDiv.innerHTML = "<p>Fehler beim Laden der Spiele. Siehe Konsole.</p>";
      return;
    }

    const data = await res.json();

    if (!data || !Array.isArray(data.response)) {
      console.error("Daten sind nicht im erwarteten Format:", data);
      gamesDiv.innerHTML = "<p>Fehler: keine Spieldaten erhalten.</p>";
      return;
    }

    // Vorhersagen für jedes Spiel abrufen
    const predictions = await fetchPredictionForGames(data.response);

    gamesDiv.innerHTML = "";
    data.response.forEach((game, index) => {
      const prediction = predictions[index];
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <div><strong>${game.home}</strong> vs <strong>${game.away}</strong> (${game.league}) - Vorhersage: ${prediction.homeWin} | Trend: ${game.trend}</div>
        <div><strong>Vorhersage für Heimsieg:</strong> ${prediction.homeWin}%</div>
        <div><strong>Vorhersage für Unentschieden:</strong> ${prediction.draw}%</div>
        <div><strong>Vorhersage für Auswärtssieg:</strong> ${prediction.awayWin}%</div>
      `;
      gamesDiv.appendChild(div);
    });

  } catch (err) {
    console.error("Fehler beim Laden der Spiele:", err);
    gamesDiv.innerHTML = "<p>Fehler beim Laden der Spiele. Siehe Konsole.</p>";
  }
}

// API-Aufruf, um Vorhersagen zu laden
async function fetchPredictionForGames(games) {
  const predictions = [];
  for (const game of games) {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        homeTeam: game.home,
        awayTeam: game.away,
        homeXG: game.homeXG,
        awayXG: game.awayXG,
      }),
    });
    const data = await res.json();
    predictions.push(data.prediction);
  }
  return predictions;
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);
