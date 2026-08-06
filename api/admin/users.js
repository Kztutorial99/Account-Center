const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");
const { isAdmin } = require("./_auth");

const ROLES = new Set(["user", "admin"]);

function parseBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateUserInput(body, { requireId = false } = {}) {
  const id = cleanText(body.id, 160);
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 320).toLowerCase();
  const role = cleanText(body.role || "user", 20).toLowerCase();
  if (requireId && !id) return { error: "id akun wajib diisi" };
  if (!name) return { error: "Nama wajib diisi" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email tidak valid" };
  if (!ROLES.has(role)) return { error: "Role hanya boleh user atau admin" };
  return { id, name, email, role };
}

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

    if (request.method === "POST") {
      const body = parseBody(request);
      const input = validateUserInput(body);
      if (input.error) return response.status(400).json({ error: input.error });

      const id = crypto.randomUUID();
      const [user] = await sql`
        INSERT INTO neon_auth."user"
          (id, name, email, "emailVerified", role, banned, "createdAt", "updatedAt")
        VALUES
          (${id}, ${input.name}, ${input.email}, false, ${input.role}, false, NOW(), NOW())
        RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
      `;
      return response.status(201).json({ user });
    }

    if (request.method === "PATCH") {
      const body = parseBody(request);
      const input = validateUserInput(body, { requireId: true });
      if (input.error) return response.status(400).json({ error: input.error });
      if (typeof body.banned !== "boolean") return response.status(400).json({ error: "Status akun wajib diisi" });
      const reason = body.banned ? cleanText(body.banReason, 240) || "Dinonaktifkan oleh admin" : null;
      const [user] = await sql`
        UPDATE neon_auth."user"
        SET name = ${input.name}, email = ${input.email}, role = ${input.role},
            banned = ${body.banned}, "banReason" = ${reason}, "banExpires" = NULL, "updatedAt" = NOW()
        WHERE id = ${input.id}
        RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
      `;
      if (!user) return response.status(404).json({ error: "Akun tidak ditemukan" });
      return response.status(200).json({ user });
    }

    if (request.method === "DELETE") {
      const body = parseBody(request);
      const id = cleanText(body.id || request.query?.id, 160);
      if (!id) return response.status(400).json({ error: "id akun wajib diisi" });
      const [user] = await sql`
        DELETE FROM neon_auth."user"
        WHERE id = ${id}
        RETURNING id, email
      `;
      if (!user) return response.status(404).json({ error: "Akun tidak ditemukan" });
      return response.status(200).json({ deleted: user });
    }

    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin users API failed", error);
    if (error?.code === "23505") return response.status(409).json({ error: "Email tersebut sudah terdaftar" });
    return response.status(500).json({ error: "Operasi akun gagal diproses" });
  }
};