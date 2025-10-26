import puppeteer from "puppeteer";

export const LEAGUE_URLS = {
  "Premier League": "https://www.flashscore.com/football/england/premier-league/results/",
  "Bundesliga": "https://www.flashscore.com/football/germany/bundesliga/results/",
  "2. Bundesliga": "https://www.flashscore.com/football/germany/2-bundesliga/results/",
  "La Liga": "https://www.flashscore.com/football/spain/laliga/results/",
  "Serie A": "https://www.flashscore.com/football/italy/serie-a/results/",
  "Ligue 1": "https://www.flashscore.com/football/france/ligue-1/results/"
};

export async function fetchFlashscoreGames(leagueUrl) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(leagueUrl, { waitUntil: "networkidle2" });
  await page.waitForSelector(".event__match", { timeout: 15000 });

  const games = await page.evaluate(() => {
    const matches = [];
    document.querySelectorAll(".event__match").forEach(row => {
      const home = row.querySelector(".event__participant--home")?.textContent.trim();
      const away = row.querySelector(".event__participant--away")?.textContent.trim();
      const time = row.querySelector(".event__time")?.textContent.trim() || null;
      if(home && away) matches.push({ home, away, time });
    });
    return matches;
  });

  await browser.close();
  return games;
}
