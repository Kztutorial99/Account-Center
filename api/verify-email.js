const { db, ensureTables } = require("./_users");
const { hashVerificationToken } = require("./_email-verification");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).send("Method not allowed");
  }

  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      return response.redirect(302, "/login?verification=invalid");
    }

    const sql = db();
    await ensureTables(sql);
    const tokenHash = hashVerificationToken(token);
    const rows = await sql`
      UPDATE codexa_users
      SET email_verified_at = NOW(), verification_token_hash = NULL, verification_expires_at = NULL
      WHERE verification_token_hash = ${tokenHash}
        AND verification_expires_at > NOW()
        AND email_verified_at IS NULL
      RETURNING id
    `;

    return response.redirect(302, rows.length ? "/login?verification=success" : "/login?verification=invalid");
  } catch (error) {
    console.error("Email verification failure", error && error.message);
    return response.redirect(302, "/login?verification=error");
  }
};