const fs = require('fs');
let code = fs.readFileSync('src/click-deck/lib/seed-data.js', 'utf8');
const covers = {
  'Monkey Island 2': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/32460/header.jpg',
  'Fate of Atlantis': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/6010/header.jpg',
  'Day of the Tentacle': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/388210/header.jpg',
  'Gabriel Knight': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/262000/header.jpg',
  'The Dig': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/6040/header.jpg',
  'The Longest Journey': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/6310/header.jpg',
  'Syberia': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3660220/header.jpg',
  'Machinarium': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/40700/header.jpg',
  'Kentucky Route Zero': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/231200/header.jpg',
  'Return of the Obra Dinn': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/653530/header.jpg',
  'The Case of the Golden Idol': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1677770/header.jpg',
  'Pentiment': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1205520/header.jpg',
  'Chants of Sennaar': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1931770/header.jpg',
  'Norco': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1221250/header.jpg',
  'Stray': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1332010/header.jpg'
};
Object.keys(covers).forEach(key => {
  code = code.replace(
    new RegExp('title: \"' + key + '[^\}]*?journal: \"[^\"]*\"', 'g'),
    (match) => match + ',\n    coverUrl: \"' + covers[key] + '\"'
  );
});
fs.writeFileSync('src/click-deck/lib/seed-data.js', code);
console.log('Done replacing seed-data!');
