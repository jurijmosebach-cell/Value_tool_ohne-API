const API_URL = "/api/games";

async function fetchGames() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return data.response || [];
}

async function fetchTopGames() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return {
    topValue: data.top7Value || [],
    topOver: data.top5Over25 || []
  };
}

function createBar(value, label, color) {
  const wrapper = document.createElement("div");
  wrapper.className = "value-bar-wrapper";
  const bar = document.createElement("div");
  bar.className = "value-bar";
  bar.style.width = `${Math.min(Math.abs(value)*50,100)}%`;
  bar.style.backgroundColor = color;
  const text = document.createElement("span");
  text.className = "bar-label";
  text.textContent = `${label}: ${value}`;
  wrapper.appendChild(bar);
  wrapper.appendChild(text);
  return wrapper;
}

function renderGamesTable(games, container) {
  container.innerHTML = "";
  games.forEach(g => {
    const row = document.createElement("div");
    row.className = "game-row";
    row.innerHTML = `
      <div class="team"><img src="${g.homeLogo}" alt="${g.home}" /> ${g.home}</div>
      <div class="team"><img src="${g.awayLogo}" alt="${g.away}" /> ${g.away}</div>
      <div class="league">${g.league}</div>
      <div class="trend">Trend: ${g.trend}</div>
      <div class="bars"></div>
    `;
    const barsContainer = row.querySelector(".bars");
    barsContainer.appendChild(createBar(g.value.home,"H",g.value.home>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.draw,"D",g.value.draw>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.away,"A",g.value.away>=0?"#4caf50":"#f44336"));
    barsContainer.appendChild(createBar(g.value.over25,"O2.5",g.value.over25>=0?"#2196f3":"#f44336"));
    barsContainer.appendChild(createBar(g.value.under25,"U2.5",g.value.under25>=0?"#2196f3":"#f44336"));
    container.appendChild(row);
  });
}

function renderTopList(list, container, type){
  container.innerHTML = "";
  list.forEach(g=>{
    const item = document.createElement("div");
    item.className = "top-item";
    let val = type==="value"?Math.max(g.value.home,g.value.draw,g.value.away):g.value.over25;
    let trend="";
    if(type==="value"){
      if(val===g.value.home) trend="home";
      else if(val===g.value.draw) trend="draw";
      else trend="away";
    }
    item.textContent = `${g.home} vs ${g.away} (${g.league}) → ${trend} ${val}`;
    container.appendChild(item);
  });
}

async function init(){
  const gamesContainer = document.getElementById("games-container");
  const topValueContainer = document.getElementById("top-value");
  const topOverContainer = document.getElementById("top-over");

  const allGames = await fetchGames();
  const topGames = await fetchTopGames();

  renderTopList(topGames.topValue, topValueContainer,"value");
  renderTopList(topGames.topOver, topOverContainer,"over");
  renderGamesTable(allGames, gamesContainer);
}

document.getElementById("refresh-btn").addEventListener("click", init);

init();
setInterval(init,15*60*1000);
