const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.DATABASE_URL) {
    return response.status(500).json({ error: "DATABASE_URL is not configured" });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM neon_auth."user"
      WHERE banned IS NOT TRUE
    `;

    return response.status(200).json({
      products: [],
      orders: [],
      customerCount: count,
      source: "neon_auth",
    });
  } catch (error) {
    console.error("Failed to read Neon data", error);
    return response.status(500).json({ error: "Unable to read account data" });
  }
};