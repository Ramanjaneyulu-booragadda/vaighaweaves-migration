const { Client } = require('pg');
(async () => {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  const res = await pg.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'order_line_item' ORDER BY ordinal_position`);
  console.log('order_line_item columns:');
  res.rows.forEach(r => console.log(`  ${r.column_name.padEnd(40)} ${r.data_type}`));
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
