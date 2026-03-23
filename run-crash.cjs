process.on("uncaughtException", (e) => {
  console.error("MY CRASH LOG:");
  console.error(e.stack || e);
  process.exit(1);
});
require('./dist/index.cjs');
