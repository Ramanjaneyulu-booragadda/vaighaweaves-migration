const mysql = require('mysql2/promise');
const { Client } = require('pg');
(async () => {
  const conn = await mysql.createConnection({
    host: 'yamabiko.proxy.rlwy.net', port: 45132, user: 'root',
    password: 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf', database: 'railway'
  });
  const tables = ['stock_events', 'order_events'];
  for (const t of tables) {
    try {
      const [cols] = await conn.query(`DESCRIBE ${t}`);
      console.log(`\n=== MySQL ${t} ===`);
      cols.forEach(r => console.log(`  ${r.Field.padEnd(35)} ${r.Type.padEnd(40)} null=${r.Null}`));
      const [cnt] = await conn.query(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`  count: ${cnt[0].c}`);
      const [sample] = await conn.query(`SELECT * FROM ${t} LIMIT 2`);
      console.log('  sample:', JSON.stringify(sample, null, 2));
    } catch(e) { console.log(`  ${t} — not found: ${e.message}`); }
  }
  // Also check what stock-related tables exist
  const [tbls] = await conn.query(`SHOW TABLES LIKE '%stock%'`);
  console.log('\nMySQL tables matching stock:', tbls);
  await conn.end();

  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  // Custom tables from script 01
  const res = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'stock_event' ORDER BY ordinal_position`);
  console.log('\n=== PostgreSQL stock_event (custom) ===');
  res.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
  const cnt2 = await pg.query('SELECT COUNT(*) FROM stock_event');
  console.log('  current count:', cnt2.rows[0].count);
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
