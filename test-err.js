const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/battles',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'connect.sid=s%3A7oQ7XQZ-R4uOTuE9aZzX-y9zC5tUQU9f.P%2F1H8bQcR4B3C5rGfVvTbUqO7nKjPzQ1rZpXtG%2BbKw' // Fake cookie, might be 401. We need a real session?
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk });
  res.on('end', () => console.log(res.statusCode, data));
});

req.on('error', e => console.error(e));
req.write(JSON.stringify({
  language: 'uz',
  mode: '30',
  maxParticipants: 10,
  genderRestriction: 'all',
  accessCode: ''
}));
req.end();
