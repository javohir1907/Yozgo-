const express = require('express');
const app = express();
const port = 3125;
app.use((req, res, next) => {
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  next();
});
app.post('/test', (req, res) => {
  res.status(200).json({ success: true });
});
const svr = app.listen(port, async () => {
  const r = await fetch(`http://localhost:${port}/test`, { method: 'POST' });
  const text = await r.text();
  console.log("RESPONSE BODY:", text);
  svr.close();
});
