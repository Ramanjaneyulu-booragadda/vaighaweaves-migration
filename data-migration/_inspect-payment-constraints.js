const { Client } = require('pg');
(async () => {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();
  // Check constraints on payment tables
  const res = await pg.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.table_name IN ('payment_collection','payment_session','payment','order_payment_collection')
    AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
    ORDER BY tc.table_name, tc.constraint_type, kcu.column_name
  `);
  res.rows.forEach(r => console.log(`${r.table_name.padEnd(30)} ${r.constraint_type.padEnd(15)} ${r.column_name}`));
  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
