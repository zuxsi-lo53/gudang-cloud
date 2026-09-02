import { Hono } from 'hono';

const app = new Hono();

app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  if (c.req.method === 'OPTIONS') return c.text(200);
  await next();
});

app.get('/api/barang', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM barang ORDER BY updated_at DESC").all();
    return c.json(results);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/barang', async (c) => {
  try {
    const { id, nama, sku, jumlah, kategori, tipeTransaksi } = await c.req.json();
    const existing = await c.env.DB.prepare("SELECT * FROM barang WHERE sku = ?").bind(sku).first();
    const trxId = crypto.randomUUID();
    const tgl = new Date().toISOString();

    if (existing) {
      let jumlahBaru = parseInt(jumlah);
      let jenisTrx = tipeTransaksi || 'UPDATE';
      
      await c.env.DB.prepare(
        "UPDATE barang SET nama = ?, jumlah = ?, kategori = ?, updated_at = CURRENT_TIMESTAMP WHERE sku = ?"
      ).bind(nama, jumlahBaru, kategori, sku).run();

      await c.env.DB.prepare(
        "INSERT INTO transaksi (id, sku, nama_barang, tipe, jumlah, tanggal) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(trxId, sku, nama, jenisTrx, jumlahBaru, tgl).run();

      return c.json({ message: "Stok berhasil diperbarui!", status: "updated" });
    } else {
      const barangId = id || crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO barang (id, nama, sku, jumlah, kategori) VALUES (?, ?, ?, ?, ?)"
      ).bind(barangId, nama, sku, parseInt(jumlah), kategori).run();

      await c.env.DB.prepare(
        "INSERT INTO transaksi (id, sku, nama_barang, tipe, jumlah, tanggal) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(trxId, sku, nama, 'BARU', parseInt(jumlah), tgl).run();

      return c.json({ message: "Barang baru berhasil ditambahkan!", status: "created" });
    }
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/barang/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare("DELETE FROM barang WHERE id = ?").bind(id).run();
    return c.json({ message: "Barang berhasil dihapus!" });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/rekap', async (c) => {
  try {
    const periode = c.req.query('periode') || 'semua';
    let query = "SELECT * FROM transaksi";
    if (periode === 'mingguan') {
      query = "SELECT * FROM transaksi WHERE tanggal >= datetime('now', '-7 days')";
    } else if (periode === 'bulanan') {
      query = "SELECT * FROM transaksi WHERE tanggal >= datetime('now', '-30 days')";
    }
    query += " ORDER BY tanggal DESC";
    const { results } = await c.env.DB.prepare(query).all();
    return c.json(results);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
