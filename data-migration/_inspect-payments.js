const mysql = require('mysql2/promise');
const { Client } = require('pg');
(async () => {
  const conn = await mysql.createConnection({
    host: 'yamabiko.proxy.rlwy.net', port: 45132, user: 'root',
    password: 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf', database: 'railway'
  });
  const [cols] = await conn.query('DESCRIBE payments');
  console.log('=== MySQL payments ===');
  cols.forEach(r => console.log(`  ${r.Field.padEnd(35)} ${r.Type.padEnd(30)} null=${r.Null}`));
  const [cnt] = await conn.query('SELECT COUNT(*) as c FROM payments');
  console.log('count:', cnt[0].c);
  const [statuses] = await conn.query('SELECT status, COUNT(*) as c FROM payments GROUP BY status ORDER BY c DESC');
  console.log('statuses:'); statuses.forEach(r => console.log(`  ${r.status}: ${r.c}`));
  const [sample] = await conn.query('SELECT * FROM payments LIMIT 3');
  console.log('sample:', JSON.stringify(sample, null, 2));
  await conn.end();

  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  const tables = ['payment_collection', 'payment', 'payment_session', 'payment_provider'];
  for (const t of tables) {
    const res = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    if (res.rows.length) {
      console.log(`\n=== Medusa "${t}" ===`);
      res.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
    }
  }
  // enums
  const enums = await pg.query(`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname LIKE '%payment%' ORDER BY t.typname, e.enumsortorder`);
  console.log('\n=== payment enums ==='); enums.rows.forEach(r => console.log(`  ${r.typname}: ${r.enumlabel}`));
  // order_payment_collection join
  const opc = await pg.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_payment_collection' ORDER BY ordinal_position`);
  console.log('\n=== order_payment_collection ==='); opc.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
