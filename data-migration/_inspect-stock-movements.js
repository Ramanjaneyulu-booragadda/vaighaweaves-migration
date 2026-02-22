const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: 'yamabiko.proxy.rlwy.net', port: 45132, user: 'root',
    password: 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf', database: 'railway'
  });
  const [cols] = await conn.query('DESCRIBE stock_movements');
  console.log('=== stock_movements ===');
  cols.forEach(r => console.log(`  ${r.Field.padEnd(35)} ${r.Type} null=${r.Null}`));
  const [cnt] = await conn.query('SELECT COUNT(*) as c FROM stock_movements');
  console.log('count:', cnt[0].c);
  const [types] = await conn.query('SELECT movement_type, COUNT(*) as c FROM stock_movements GROUP BY movement_type ORDER BY c DESC');
  console.log('types:'); types.forEach(r => console.log(`  ${r.movement_type}: ${r.c}`));
  const [sample] = await conn.query('SELECT * FROM stock_movements LIMIT 2');
  console.log('sample:', JSON.stringify(sample, null, 2));
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
