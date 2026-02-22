const mysql = require('mysql2/promise');
const { Client } = require('pg');
(async () => {
  const conn = await mysql.createConnection({
    host: 'yamabiko.proxy.rlwy.net', port: 45132, user: 'root',
    password: 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf', database: 'railway'
  });
  const [cols] = await conn.query('DESCRIBE shipments');
  console.log('=== MySQL shipments ===');
  cols.forEach(r => console.log(`  ${r.Field.padEnd(35)} ${r.Type} null=${r.Null}`));
  const [cnt] = await conn.query('SELECT COUNT(*) as c FROM shipments');
  console.log('count:', cnt[0].c);
  const [statuses] = await conn.query('SELECT status, COUNT(*) as c FROM shipments GROUP BY status ORDER BY c DESC');
  console.log('statuses:'); statuses.forEach(r => console.log(`  ${r.status}: ${r.c}`));
  const [carriers] = await conn.query('SELECT carrier, COUNT(*) as c FROM shipments GROUP BY carrier ORDER BY c DESC');
  console.log('carriers:'); carriers.forEach(r => console.log(`  ${r.carrier}: ${r.c}`));
  const [sample] = await conn.query('SELECT * FROM shipments LIMIT 2');
  console.log('sample:', JSON.stringify(sample, null, 2));
  await conn.end();

  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  // Check Medusa fulfillment tables
  const tbls = await pg.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'fulfillment%' ORDER BY table_name`);
  console.log('\nFulfillment tables:'); tbls.rows.forEach(r => console.log(' ', r.table_name));
  for (const t of ['fulfillment', 'fulfillment_item', 'fulfillment_label', 'fulfillment_provider']) {
    const res = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    if (res.rows.length) {
      console.log(`\n=== ${t} ===`);
      res.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type} nullable=${r.is_nullable}`));
    }
  }
  // Also check order_fulfillment join
  const of_ = await pg.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_fulfillment' ORDER BY ordinal_position`);
  console.log('\n=== order_fulfillment ==='); of_.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
  // enums
  const enums = await pg.query(`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname LIKE '%fulfillment%' ORDER BY t.typname, e.enumsortorder`);
  if (enums.rows.length) { console.log('\nFulfillment enums:'); enums.rows.forEach(r => console.log(`  ${r.typname}: ${r.enumlabel}`)); }
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
