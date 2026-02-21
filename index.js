// ================= OWNER CONFIG =================

const OWNER_ID = 123456789; // ← YOUR TELEGRAM NUMERIC ID
const PANEL_SECURITY_CODE = "0970654766"; // ← PANEL SECURITY CODE
const MASTER_SECRET_KEY = "REPLACE_WITH_SECRET_KEY";
const MAX_BOTS_PER_USER = 3;

// =================================================

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/webhook/")) {
      const token = url.pathname.split("/")[2];
      const update = await req.json();
      await initDB(env);
      return await handleUpdate(update, token, env);
    }

    return new Response("Worker Alive");
  }
};

// ================= DATABASE INIT =================

async function initDB(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      encrypted_token TEXT,
      status TEXT,
      created_at TEXT
    );
  `);
}

// ================= UPDATE HANDLER =================

async function handleUpdate(update, token, env) {
  if (!update.message) return new Response("No message");

  const msg = update.message;
  const userId = msg.from.id;
  const text = msg.text || "";

  if (userId === OWNER_ID && text === "/panel") {
    await sendTelegram(token, userId, "👑 پنل مدیریت فعال شد");
    return new Response("Panel Opened");
  }

  return new Response("OK");
}

// ================= REGISTER BOT =================

async function registerBot(userId, token, env) {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM bots WHERE owner_id = ?"
  ).bind(userId).all();

  if (results[0].count >= MAX_BOTS_PER_USER && userId !== OWNER_ID) {
    return false;
  }

  const encrypted = await encrypt(token);

  await env.DB.prepare(
    "INSERT INTO bots (owner_id, encrypted_token, status, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(userId, JSON.stringify(encrypted), "active", new Date().toISOString())
    .run();

  return true;
}

// ================= ENCRYPTION =================

async function encrypt(text) {
  const enc = new TextEncoder().encode(text);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MASTER_SECRET_KEY),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

// ================= TELEGRAM API =================

async function sendTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}
