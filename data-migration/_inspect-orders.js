const mysql = require('mysql2/promise');
const { Client } = require('pg');

(async () => {
  // MySQL
  const conn = await mysql.createConnection({
    host: 'yamabiko.proxy.rlwy.net', port: 45132, user: 'root',
    password: 'dZnlTmgUAXBBEZejWJsnmfNsmhNVAthf', database: 'railway'
  });

  const [orders] = await conn.query('DESCRIBE orders');
  console.log('=== MySQL orders ===');
  console.table(orders);

  const [items] = await conn.query('DESCRIBE order_items');
  console.log('=== MySQL order_items ===');
  console.table(items);

  const [cnt] = await conn.query('SELECT COUNT(*) as c FROM orders');
  console.log('orders count:', cnt[0].c);

  const [icnt] = await conn.query('SELECT COUNT(*) as c FROM order_items');
  console.log('order_items count:', icnt[0].c);

  const [statuses] = await conn.query('SELECT status, COUNT(*) as c FROM orders GROUP BY status ORDER BY c DESC');
  console.log('order statuses:');
  console.table(statuses);

  const [sample] = await conn.query('SELECT * FROM orders LIMIT 2');
  console.log('sample orders:', JSON.stringify(sample, null, 2));

  const [isample] = await conn.query('SELECT * FROM order_items LIMIT 3');
  console.log('sample order_items:', JSON.stringify(isample, null, 2));

  await conn.end();

  // PostgreSQL - Medusa order tables
  const pg = new Client({ host: 'localhost', port: 5432, user: 'prudhvi', password: 'Oldisgold%402026', database: 'vaighaweaves_db_dev' });
  await pg.connect();

  const tables = ['order', 'order_line_item', 'order_address', 'order_shipping_method', 'order_item'];
  for (const t of tables) {
    const res = await pg.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log(`\n=== Medusa ${t} ===`);
    console.table(res.rows);
  }

  await pg.end();
})().catch(e => { console.error(e); process.exit(1); });
