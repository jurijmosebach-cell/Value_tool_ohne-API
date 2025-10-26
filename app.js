async function fetchGames() {
  try { const res = await fetch("/api/games"); return await res.json(); }
  catch(err){ console.error(err); return {response:[],top7Value:[],top5Over25:[]}; }
}

function formatDate(iso){ return new Date(iso).toLocaleString([],{dateStyle:"short",timeStyle:"short"}); }

function renderGameBars(g, container){
  const row=document.createElement("div"); row.className="value-row-full";
  ["home","draw","away","over25","under25"].forEach(k=>{
    const val=g.value[k];
    const bar=document.createElement("div");
    bar.className="value-bar"; 
    bar.style.width=`${Math.min(120,Math.abs(val)*30)}px`;
    const colors={home:"#16a34a",draw:"#facc15",away:"#ef4444",over25:"#06b6d4",under25:"#7c3aed"};
    bar.style.backgroundColor=colors[k];
    bar.textContent=`${k}: ${val}`;
    row.appendChild(bar);
  });
  container.appendChild(row);
}

function renderGames(games){
  const container=document.getElementById("games"); container.innerHTML="";
  if(!games.length){ container.innerHTML="<p class='muted'>Keine Spiele gefunden.</p>"; return; }
  games.forEach(g=>{
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=`
      <div class="row top">
        <div class="team"><img src="${g.homeLogo}" class="logo"><div class="team-name">${g.home}</div></div>
        <div class="meta"><div class="league">${g.league}</div><div class="date">${formatDate(g.utcDate)}</div></div>
        <div class="team away"><img src="${g.awayLogo}" class="logo"><div class="team-name">${g.away}</div></div>
      </div>
      <div class="row stats">
        <div class="xg"><div>xG: <strong>${g.homeXG}</strong> — <strong>${g.awayXG}</strong></div>
        <div class="xg-bars"><div class="bar-wrap"><div class="bar" style="width:${Math.min(120,g.homeXG*40)}px"></div></div>
        <div class="bar-wrap"><div class="bar alt" style="width:${Math.min(120,g.awayXG*40)}px"></div></div></div></div>
      </div>
    `;
    container.appendChild(card);
    renderGameBars(g,card);
  });
}

function renderTopLists(top7,top5){
  const wrap=document.getElementById("toplists"); wrap.innerHTML="";
  const sec1=document.createElement("section"); sec1.className="top-section";
  sec1.innerHTML="<h2>Top 7 Value Wetten</h2>";
  top7.forEach(g=>{ const div=document.createElement("div"); const best=Object.entries(g.value).sort((a,b)=>b[1]-a[1])[0]; div.textContent=`${g.home} vs ${g.away} (${g.league}) → ${best[0]} ${best[1]}`; sec1.appendChild(div); });
  wrap.appendChild(sec1);

  const sec2=document.createElement("section"); sec2.className="top-section"; sec2.innerHTML="<h2>Top 5 Over 2.5</h2>";
  top5.forEach(g=>{ const div=document.createElement("div"); div.textContent=`${g.home} vs ${g.away} (${g.league}) → Value ${g.value.over25}`; sec2.appendChild(div); });
  wrap.appendChild(sec2);
}

async function init(){
  const {response,top7Value,top5Over25}=await fetchGames();
  renderTopLists(top7Value,top5Over25);
  renderGames(response);
}

document.addEventListener("DOMContentLoaded",()=>{
  init();
  document.getElementById("refresh").addEventListener("click",()=>{
    const btn=document.getElementById("refresh"); btn.classList.add("loading");
    init().finally(()=>btn.classList.remove("loading"));
  });
});
