import https from 'https';

const games = [
  "Monkey Island 2: LeChuck's Revenge",
  "Indiana Jones and the Fate of Atlantis",
  "Day of the Tentacle Remastered",
  "Gabriel Knight: Sins of the Fathers",
  "The Dig",
  "The Longest Journey",
  "Syberia",
  "Machinarium",
  "Kentucky Route Zero",
  "Return of the Obra Dinn",
  "The Case of the Golden Idol",
  "Pentiment",
  "Chants of Sennaar",
  "Norco",
  "Stray"
];

async function searchSteam(title) {
  return new Promise((resolve, reject) => {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.items && json.items.length > 0) {
            resolve({ title, id: json.items[0].id });
          } else {
            resolve({ title, id: null });
          }
        } catch (e) {
          resolve({ title, id: null });
        }
      });
    }).on('error', e => resolve({ title, id: null }));
  });
}

async function run() {
  for (const game of games) {
    const res = await searchSteam(game);
    if (res.id) {
      console.log(`- ${res.title}: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${res.id}/header.jpg`);
    } else {
      console.log(`- ${res.title}: Not found`);
    }
  }
}

run();
