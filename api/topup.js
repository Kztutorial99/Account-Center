const crypto = require("crypto");
const { db, ensureTables, currentUser, bodyOf, text } = require("./_users");
const { notifyNewTopup } = require("./_telegram");
const { createNotification } = require("./_notifications");

const MIN_TOPUP = 10000;
const MAX_TOPUP = 20000000;

module.exports = async function handler(request, response) {
  try {
    const sql = db();
    await ensureTables(sql);
    const user = await currentUser(sql, request);
    if (!user) return response.status(401).json({ error: "Silakan masuk terlebih dahulu" });

    if (request.method === "GET") {
      const rows = await sql`
        SELECT id, amount, method, reference, note, status,
               created_at AS "createdAt", reviewed_at AS "reviewedAt"
        FROM codexa_topups WHERE user_id = ${user.id}
        ORDER BY created_at DESC LIMIT 30
      `;
      // Total pending dihitung agregat di server, bukan dari 30 baris terakhir,
      // supaya user dengan riwayat panjang tetap melihat angka yang benar.
      const [agg] = await sql`
        SELECT COALESCE(SUM(amount), 0)::bigint AS "pendingTotal", COUNT(*)::int AS "pendingCount"
        FROM codexa_topups WHERE user_id = ${user.id} AND status = 'pending'
      `;
      return response.status(200).json({
        balance: user.balance,
        pendingTotal: Number(agg && agg.pendingTotal) || 0,
        pendingCount: Number(agg && agg.pendingCount) || 0,
        topups: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
      });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed" });
    }

    const body = bodyOf(request);
    const amount = Math.round(Number(body.amount) || 0);
    const method = text(body.method, 40) || "Transfer Bank";
    const reference = text(body.reference, 120);
    const note = text(body.note, 300);
    const proof = typeof body.proof === "string" ? body.proof : "";

    if (!Number.isFinite(amount) || amount < MIN_TOPUP) {
      return response.status(400).json({ error: `Minimal top up Rp${MIN_TOPUP.toLocaleString("id-ID")}` });
    }
    if (amount > MAX_TOPUP) return response.status(400).json({ error: "Nominal top up terlalu besar" });
    if (!reference) return response.status(400).json({ error: "Nomor ID transaksi wajib diisi" });
    if (!proof) return response.status(400).json({ error: "Bukti transfer wajib diunggah" });
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(proof)) {
      return response.status(400).json({ error: "Bukti transfer harus berupa gambar (JPG/PNG/WebP)" });
    }
    if (proof.length > 8 * 1024 * 1024) {
      return response.status(400).json({ error: "Ukuran bukti transfer terlalu besar" });
    }

    const pending = await sql`
      SELECT COUNT(*)::int AS total FROM codexa_topups WHERE user_id = ${user.id} AND status = 'pending'
    `;
    if ((pending[0] && pending[0].total) >= 3) {
      return response.status(429).json({ error: "Masih ada 3 permintaan top up menunggu verifikasi" });
    }

    const rows = await sql`
      INSERT INTO codexa_topups (id, user_id, amount, method, reference, note, proof_blob)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${amount}, ${method}, ${reference}, ${note}, ${proof})
      RETURNING id, amount, method, reference, note, status, created_at AS "createdAt", reviewed_at AS "reviewedAt"
    `;
    const topup = { ...rows[0], amount: Number(rows[0].amount) || 0 };

    // Kirim notifikasi ke admin lewat bot Telegram. Kegagalan Telegram
    // tidak boleh membatalkan permintaan top up yang sudah tersimpan.
    try {
      await notifyNewTopup({ topup, user, proof });
    } catch (notifyError) {
      console.error("Telegram notify failure", notifyError && notifyError.message);
    }

    await createNotification(sql, {
      userId: user.id,
      type: "topup_pending",
      title: "Permintaan top up terkirim",
      body: `Top up Rp${amount.toLocaleString("id-ID")} lewat ${method} sedang menunggu verifikasi admin.`,
      link: "topup",
    });

    return response.status(201).json({ topup });
  } catch (error) {
    console.error("Topup failure", error && error.message);
    return response.status(500).json({ error: "Permintaan top up gagal diproses" });
  }
};
