const http = require('http');
const postData = JSON.stringify({ fullName:'Test Lead', email:'test@example.com', phone:'9999999999', service:'smo', requirements:'testing db' });
const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('POST status', res.statusCode, body);
    if (res.statusCode !== 200) return process.exit(1);
    http.get('http://127.0.0.1:3000/api/leads', (getRes) => {
      let getBody = '';
      getRes.on('data', (chunk) => getBody += chunk);
      getRes.on('end', () => {
        console.log('GET status', getRes.statusCode, getBody);
        try {
          const parsed = JSON.parse(getBody);
          console.log('leads count', Array.isArray(parsed.leads) ? parsed.leads.length : 'invalid');
          process.exit(parsed.leads && parsed.leads.length >= 1 ? 0 : 1);
        } catch (err) {
          console.error('parse error', err.message);
          process.exit(1);
        }
      });
    }).on('error', (err) => { console.error('GET error', err.message); process.exit(1); });
  });
});
req.on('error', (err) => { console.error('POST error', err.message); process.exit(1); });
req.write(postData);
req.end();
