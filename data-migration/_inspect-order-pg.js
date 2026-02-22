const { Client } = require('pg');
(async () => {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();

  const tables = ['order', 'order_line_item', 'order_address', 'order_item', 'order_summary'];
  for (const t of tables) {
    const res = await pg.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    );
    if (res.rows.length > 0) {
      console.log(`\n=== Medusa "${t}" (${res.rows.length} cols) ===`);
      res.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type.padEnd(30)} nullable=${r.is_nullable} default=${r.column_default}`));
    } else {
      console.log(`\n=== "${t}" — TABLE NOT FOUND ===`);
    }
  }
  // Also check order_status enum
  const enums = await pg.query(`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname LIKE '%order%' ORDER BY t.typname, e.enumsortorder`);
  console.log('\n=== order-related enums ===');
  console.table(enums.rows);

  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
