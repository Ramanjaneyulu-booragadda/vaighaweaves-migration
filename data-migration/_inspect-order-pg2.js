const { Client } = require('pg');
(async () => {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  // Check all order-related tables
  const res = await pg.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'order%' ORDER BY table_name`);
  console.log('Order-related tables:'); res.rows.forEach(r => console.log(' ', r.table_name));
  // order_transaction
  const ot = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'order_transaction' ORDER BY ordinal_position`);
  console.log('\n=== order_transaction ==='); ot.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
  // order_shipping
  const os = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'order_shipping' ORDER BY ordinal_position`);
  console.log('\n=== order_shipping ==='); os.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`));
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
