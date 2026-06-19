const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================= FIREBASE INIT =================
admin.initializeApp({
  credential: admin.credential.cert(require("./firebase-service.json")),
});

const db = admin.firestore();

// ================= CONFIG =================
const GAMBLLY_BASE_URL = "https://game.gambllyapi.com/production";
const API_KEY = process.env.GAMBLLY_API_KEY;   // 👈 your agency_uid
const API_SUFFIX = process.env.GAMBLLY_SUFFIX; // b24d2
const CURRENCY = "INR";

// ================= HELPERS =================

// get user from firestore
async function getUser(uid) {
  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("User not found");
  return { id: doc.id, ...doc.data() };
}

// update balance
async function updateBalance(uid, amount) {
  const ref = db.collection("users").doc(uid);

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists) throw new Error("User not found");

    let balance = doc.data().balance || 0;
    balance = Number(balance) + Number(amount);

    t.update(ref, { balance });
  });

  const updated = await ref.get();
  return updated.data().balance;
}

// ================= GAME LAUNCH =================

app.post("/api/game/launch", async (req, res) => {
  try {
    const { uid, game_uid, home_url, platform, language } = req.body;

    const user = await getUser(uid);

    const payload = new URLSearchParams({
      member_account: uid,
      game_uid,
      credit_amount: user.balance || 0,
      currency_code: CURRENCY,
      language: language || "en",
      platform: platform || 1,
      api_key: API_KEY,
      home_url: home_url,
      transfer_id: Date.now().toString(),
    });

    const url = `${GAMBLLY_BASE_URL}/v1${API_SUFFIX}/gameLaunch.php`;

    const response = await axios.post(url, payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= CALLBACK (IMPORTANT) =================
// Gamblly will call this on BET / WIN / REFUND

app.post("/api/game/callback", async (req, res) => {
  try {
    const {
      player_id,
      bet_amount,
      win_amount,
      action,
      game_uid,
      txn_id,
      currency_code,
    } = req.body;

    console.log("Callback received:", req.body);

    let balanceChange = 0;

    // BET = deduct
    if (action === "bet") {
      balanceChange = -Number(bet_amount || 0);
    }

    // WIN = add
    if (action === "win") {
      balanceChange = Number(win_amount || 0);
    }

    // REFUND
    if (action === "refund") {
      balanceChange = Number(bet_amount || 0);
    }

    const newBalance = await updateBalance(player_id, balanceChange);

    return res.json({
      balance: newBalance,
      status: true,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
