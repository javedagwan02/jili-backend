const express = require("express");
const axios = require("axios");
const cors = require("cors");
const qs = require("qs");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const api = axios.create({ timeout: 15000 });

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const API_KEY = "YOUR_GAMBLLY_API_KEY";

app.get("/", (req, res) => {
  res.send("Backend chal raha hai ✅");
});

app.get("/ping", (req, res) => {
  res.send("OK");
});

app.get("/start-game", async (req, res) => {
  console.log("🎮 START GAME HIT");

  const userId = req.query.userId;
  const gameId = req.query.gameId;

  if (!userId || !gameId) {
    return res.json({ success: false, error: "Missing userId or gameId" });
  }

  try {
    const snapshot = await db.collection("users")
      .where("email", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: false, error: "User not found" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    const balance = Number(Number(userData.balance || 0).toFixed(2));

    let username = userData.username;

    if (!username) {
      username = userData.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      await userDoc.ref.update({ username });
    }

    console.log("👤 USER:", userId);
    console.log("🧑 USERNAME:", username);
    console.log("🎰 GAME:", gameId);
    console.log("💰 BALANCE:", balance);

    await db.collection("liveUsers").doc(userId).set({
      email: userId,
      username,
      gameId,
      status: "online",
      startTime: Date.now()
    }, { merge: true });

    const payload = {
      member_account: username,
      game_uid: gameId,
      api_key: API_KEY,
      currency_code: "INR",
      language: "en",
      platform: 2,
      home_url: "https://2xwin.online",
      credit_amount: balance.toFixed(2),
      transfer_id: Date.now().toString()
    };

    console.log("📤 PAYLOAD:", payload);

    const response = await api.post(
      "https://game.gambllyapi.com/production/v1/gameLaunch.php",
      qs.stringify(payload),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("📥 PROVIDER RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.success || !response.data.game_url) {
      return res.json({
        success: false,
        error: "Provider failed",
        providerResponse: response.data
      });
    }

    return res.json({
      success: true,
      url: response.data.game_url
    });

  } catch (e) {
    console.log("❌ START GAME ERROR:", e.response?.data || e.message);

    return res.json({
      success: false,
      error: "Game launch failed",
      details: e.response?.data || e.message
    });
  }
});

app.post("/callback", async (req, res) => {
  console.log("🔥 CALLBACK HIT");
  console.log("METHOD:", req.method);
  console.log("BODY:", JSON.stringify(req.body));
  console.log("QUERY:", JSON.stringify(req.query));

  try {
    const data = req.body;

    const username =
      data.player_uid ||
      data.member_account ||
      data.username;

    if (!username) {
      return res.json({
        status: false,
        error: "Username missing"
      });
    }

    const snapshot = await db.collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("❌ USER NOT FOUND:", username);
      return res.json({
        status: false,
        error: "User not found"
      });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    let currentBalance = Number(userData.balance || 0);
    currentBalance = Number(currentBalance.toFixed(2));

    console.log("💰 OLD BALANCE:", currentBalance);

    const action = data.action || "";

    if (action === "deposit_required") {
      console.log("💳 DEPOSIT REQUIRED");

      return res.json({
        balance: currentBalance,
        status: true,
        data: {
          balance: currentBalance
        }
      });
    }

    const betAmount = Number(
      data.bet_amount ||
      data.amount ||
      data.bet ||
      0
    );

    const winAmount = Number(
      data.win_amount ||
      data.payout_amount ||
      data.payoff ||
      data.win ||
      data.payout ||
      data.prize ||
      0
    );

    console.log("🎯 BET:", betAmount);
    console.log("🏆 WIN:", winAmount);

    let newBalance = currentBalance - betAmount + winAmount;
    newBalance = Number(newBalance.toFixed(2));

    if (newBalance < 0) newBalance = 0;

    await userDoc.ref.update({
      balance: newBalance
    });

    console.log("✅ NEW BALANCE:", newBalance);

    await db.collection("liveUsers").doc(userData.email).set({
      lastSeen: Date.now(),
      status: "offline"
    }, { merge: true });

    return res.json({
      balance: newBalance,
      status: true,
      data: {
        balance: newBalance
      }
    });

  } catch (e) {
    console.log("❌ CALLBACK ERROR:", e.message);

    return res.json({
      status: false,
      error: e.message
    });
  }
});

app.get("/admin/live-users", async (req, res) => {
  try {
    const snapshot = await db.collection("liveUsers").get();

    const users = [];
    snapshot.forEach(doc => users.push(doc.data()));

    return res.json(users);

  } catch (e) {
    return res.json({
      success: false,
      error: e.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server started on port " + PORT);
});
