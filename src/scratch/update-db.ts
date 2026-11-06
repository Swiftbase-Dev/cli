import pg from "pg";

const client = new pg.Client({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5433"),
  user: process.env.DATABASE_USER || "swiftbase_auth",
  password: process.env.DATABASE_PASS || "swiftbase_auth",
  database: process.env.DATABASE_NAME || "swiftbase",
});

async function main() {
  await client.connect();
  console.log("Connected to database");
  
  // Fetch existing redirects
  const res = await client.query("SELECT id, redirect_uris FROM swiftbase.projects WHERE id = 'swiftbase'");
  if (res.rows.length > 0) {
    const current = res.rows[0].redirect_uris || [];
    const updated = Array.from(new Set([
      ...current,
      'http://localhost:3010/callback',
      'http://localhost:3010/callback/'
    ]));
    
    await client.query(
      "UPDATE swiftbase.projects SET redirect_uris = $1 WHERE id = 'swiftbase'",
      [JSON.stringify(updated)]
    );
    console.log("Successfully updated redirect_uris in database:", updated);
  } else {
    console.log("No project 'swiftbase' found in database.");
  }
  
  await client.end();
}

main().catch(console.error);
