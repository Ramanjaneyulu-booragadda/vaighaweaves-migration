const { Client } = require('pg');
(async () => {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  // Check stock_event constraints
  const cols = await pg.query(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'stock_event' ORDER BY ordinal_position`);
  console.log('stock_event nullable:'); cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(20)} nullable=${r.is_nullable}`));
  // Check what keys exist in migration_id_map for variants
  const keys = await pg.query(`SELECT old_table, new_table, COUNT(*) as c FROM migration_id_map GROUP BY old_table, new_table ORDER BY old_table`);
  console.log('\nmigration_id_map keys:'); keys.rows.forEach(r => console.log(`  ${r.old_table.padEnd(20)} → ${r.new_table.padEnd(25)} (${r.c})`));
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
