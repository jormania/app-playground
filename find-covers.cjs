const https = require('https');
const urls = [
  'https://en.wikipedia.org/wiki/The_Secret_of_Monkey_Island',
  'https://en.wikipedia.org/wiki/Beneath_a_Steel_Sky',
  'https://en.wikipedia.org/wiki/Grim_Fandango',
  'https://en.wikipedia.org/wiki/Disco_Elysium',
  'https://en.wikipedia.org/wiki/Full_Throttle_(1995_video_game)'
];
urls.forEach(url => {
  https.get(url, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const match = data.match(/upload\.wikimedia\.org\/wikipedia\/en\/[^\"\'\s]+\.(jpg|png|jpeg)/i);
      console.log(url.split('/').pop() + ': ' + (match ? 'https://' + match[0] : 'Not found'));
    });
  });
});
