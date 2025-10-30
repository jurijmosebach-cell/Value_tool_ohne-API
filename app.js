async function loadGames(date) {
  try {
    const res = await fetch(`/api/games?date=${date}`);
    const data = await res.json();
    renderGames(data.response);
  } catch (err) {
    console.error("Fehler beim Laden der Spiele:", err);
  }
}

async function loadLive() {
  try {
    const res = await fetch(`/api/live`);
    const data = await res.json();
    const liveDiv = document.getElementById("liveGames");
    liveDiv.innerHTML = "";
    if (!data.response.length) {
      liveDiv.innerHTML = "<p>Keine Live-Spiele aktuell.</p>";
      return;
    }
    data.response.forEach(g => {
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <strong>${g.league}</strong><br/>
        <img src="${g.homeLogo}" />${g.home} vs 
        <img src="${g.awayLogo}" />${g.away}<br/>
        ⏱️ ${g.minute || 0}' – ⚽ ${g.score?.home ?? 0}:${g.score?.away ?? 0}
      `;
      liveDiv.appendChild(div);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Live-Spiele:", err);
  }
}

function renderGames(games) {
  const all = document.getElementById("games");
  all.innerHTML = "";
  if (!games.length) {
    all.innerHTML = "<p>Keine Spiele gefunden.</p>";
    return;
  }
  games.forEach(g => {
    const d = document.createElement("div");
    d.className = "game";
    d.innerHTML = `
      <strong>${g.league}</strong><br/>
      <img src="${g.homeLogo}" />${g.home} vs 
      <img src="${g.awayLogo}" />${g.away}<br/>
      📅 ${g.date}<br/>
      🔢 XG ${g.homeXG} – ${g.awayXG}
    `;
    all.appendChild(d);
  });
}

document.getElementById("loadBtn").addEventListener("click", () => {
  const d = document.getElementById("date").value || new Date().toISOString().split("T")[0];
  loadGames(d);
});

document.getElementById("liveBtn").addEventListener("click", loadLive);

window.onload = () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("date").value = today;
  loadGames(today);
};
