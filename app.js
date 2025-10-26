const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

// set today
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

async function loadMatches() {
  const date = dateInput.value;
  if (!date) { 
    statusDiv.textContent = "Bitte Datum wählen!"; 
    return; 
  }
  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const json = await res.json();
    const games = json.response || [];
    if (games.length === 0) {
      statusDiv.textContent = "Keine Spiele für dieses Datum.";
      return;
    }

    // Top 7 Value Tipps
    const topValue = [...games].sort((a, b) => {
      const maxA = Math.max(a.value.home, a.value.draw, a.value.away);
      const maxB = Math.max(b.value.home, b.value.draw, b.value.away);
      return maxB - maxA;
    }).slice(0, 7);

    let valueHTML = "<h2 class='text-lg font-bold mb-2'>Top 7 Value Tipps</h2><ul class='list-disc pl-5 mb-4'>";
    topValue.forEach(g => {
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const market = bestVal === g.value.home ? "1" : bestVal === g.value.draw ? "X" : "2";
      valueHTML += `<li>${g.home} vs ${g.away} → ${market} ${(bestVal * 100).toFixed(1)}% Value</li>`;
    });
    valueHTML += "</ul>";

    // Top 5 xG Favoriten
    const topXG = [...games].sort((a, b) => (b.homeXG + b.awayXG) - (a.homeXG + a.awayXG)).slice(0, 5);
    let xgHTML = "<h2 class='text-lg font-bold mb-2'>Top 5 Favoriten (xG)</h2><ul class='list-disc pl-5 mb-4'>";
    topXG.forEach(g => {
      xgHTML += `<li>${g.home} vs ${g.away} → ${(g.homeXG + g.awayXG).toFixed(2)} xG</li>`;
    });
    xgHTML += "</ul>";

    statusDiv.innerHTML = `${games.length} Spiele geladen.` + valueHTML + xgHTML;

    // list cards
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-4 shadow border border-gray-700";
      const homeVal = g.value.home * 100;
      const drawVal = g.value.draw * 100;
      const awayVal = g.value.away * 100;
      const overVal = g.value.over25 * 100;
      const underVal = g.value.under25 * 100;

      const maxVal = Math.max(homeVal, drawVal, awayVal);
      const homeColor = homeVal === maxVal ? 'bg-green-500' : 'bg-red-500';
      const drawColor = drawVal === maxVal ? 'bg-yellow-400' : 'bg-red-500';
      const awayColor = awayVal === maxVal ? 'bg-green-500' : 'bg-red-500';
      const overColor = overVal >= underVal ? 'bg-green-500' : 'bg-red-500';
      const underColor = underVal > overVal ? 'bg-green-500' : 'bg-red-500';

      card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-8 h-8 rounded-full" alt="${g.home}"/>
            <div>
              <div class="font-bold">${g.home}</div>
              <div class="text-xs text-gray-400">${g.homeXG} xG</div>
            </div>
          </div>
          <div class="text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded-full">${g.league}</div>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="font-bold">${g.away}</div>
              <div class="text-xs text-gray-400">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" class="w-8 h-8 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm mb-2">1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}</div>
        <div class="text-sm mb-2 text-gray-300">Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"} | Under 2.5: ${g.odds.under25 ? g.odds.under25.toFixed(2) : "-"}</div>

        <div class="relative h-6 rounded-full overflow-hidden mb-2 bg-gray-700">
          <div class="${homeColor} absolute h-full left-0 top-0" style="width: ${homeVal}%"></div>
          <div class="${drawColor} absolute h-full left:${homeVal}% top-0" style="width: ${drawVal}%"></div>
          <div class="${awayColor} absolute h-full left:${homeVal + drawVal}% top-0" style="width: ${awayVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%</span>
        </div>

        <div class="relative h-6 rounded-full overflow-hidden bg-gray-700">
          <div class="${overColor} absolute h-full left-0 top-0" style="width: ${overVal}%"></div>
          <div class="${underColor} absolute h-full left:${overVal}% top-0" style="width: ${underVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">Over:${overVal.toFixed(1)}% | Under:${underVal.toFixed(1)}%</span>
        </div>
      `;
      matchList.appendChild(card);
    });

  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
