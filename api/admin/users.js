const { neon } = require("@neondatabase/serverless");
const { isAdmin } = require("./_auth");

module.exports = async function handler(request, response) {
  if (!isAdmin(request)) return response.status(401).json({ error: "Admin login diperlukan" });
  if (!process.env.DATABASE_URL) return response.status(500).json({ error: "DATABASE_URL is not configured" });

  try {
    const sql = neon(process.env.DATABASE_URL);
    if (request.method === "GET") {
      const users = await sql`
        SELECT id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
        FROM neon_auth."user"
        ORDER BY "createdAt" DESC
      `;
      return response.status(200).json({ users });
    }

    if (request.method === "PATCH") {
      const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
      if (!body.id || typeof body.banned !== "boolean") {
        return response.status(400).json({ error: "id dan status banned wajib diisi" });
      }
      const reason = body.banned ? "Dinonaktifkan oleh admin" : null;
      const [user] = await sql`
        UPDATE neon_auth."user"
        SET banned = ${body.banned}, "banReason" = ${reason}, "banExpires" = NULL, "updatedAt" = NOW()
        WHERE id = ${body.id}
        RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
      `;
      if (!user) return response.status(404).json({ error: "Akun tidak ditemukan" });
      return response.status(200).json({ user });
    }

    response.setHeader("Allow", "GET, PATCH");
    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin users API failed", error);
    return response.status(500).json({ error: "Data akun tidak bisa dimuat" });
  }
};