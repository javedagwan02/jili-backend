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

app.get("/", (req, res) => {
  res.send("Backend chal raha hai ✅");
});

app.get("/ping", (req, res) => {
  res.send("OK");
});

// ✅ SETTLE PREVIOUS GAME - FIXED
app.get("/settle-game", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.json({
      success: false,
      error: "Missing userId"
    });
  }

  try {
    const sessionRef = db.collection("liveUsers").doc(userId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.json({
        success: true,
        message: "No old session found"
      });
    }

    await sessionRef.set({
      status: "offline",
      lastSeen: Date.now()
    }, { merge: true });

    return res.json({
      success: true,
      message: "Previous game settled"
    });

  } catch (e) {
    return res.json({
      success: false,
      error: e.message
    });
  }
});

// 🔥 START GAME
app.get("/start-game", async (req, res) => {
  console.log("🎮 START GAME HIT");

  const userId = req.query.userId;
  const gameId = req.query.gameId;

  if (!userId || !gameId) {
    return res.json({
      success: false,
      error: "Missing userId or gameId"
    });
  }

  try {
    const snapshot = await db.collection("users")
      .where("email", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: false,
        error: "User not found"
      });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    let balance = parseFloat(Number(data.balance || 0).toFixed(2));

    let username;

    if (data.username) {
      username = data.username;
    } else {
      username = data.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      await doc.ref.update({ username });
    }

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
      api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
      currency_code: "INR",
      language: "en",
      platform: 2,
      home_url: "https://2xwin.online",
      callback_url: "https://jili-backend.onrender.com/callback",
      credit_amount: balance.toFixed(2),
      transfer_id: Date.now().toString()
    };

    const response = await api.post(
      "https://game.gambllyapi.com/production/v1/gameLaunch.php",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

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
    return res.json({
      success: false,
      error: "Game launch failed",
      details: e.response?.data || e.message
    });
  }
});

// 🔥 CALLBACK
app.post("/callback", async (req, res) => {
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
      return res.json({ status: false });
    }

    const doc = snapshot.docs[0];
    const userData = doc.data();

    let currentBalance = Number(userData.balance || 0);

    const betAmount = parseFloat(
      data.bet_amount ||
      data.amount ||
      data.bet ||
      0
    );

    const winAmount = parseFloat(
      data.win_amount ||
      data.payout_amount ||
      data.payoff ||
      data.win ||
      data.payout ||
      data.prize ||
      0
    );

    let newBalance = currentBalance - betAmount + winAmount;
    newBalance = parseFloat(newBalance.toFixed(2));

    if (newBalance < 0) newBalance = 0;

    await doc.ref.update({
      balance: newBalance
    });

    await db.collection("liveUsers")
      .doc(userData.email)
      .set({
        lastSeen: Date.now(),
        status: "offline"
      }, { merge: true });

    return res.json({
      status: true,
      balance: newBalance
    });

  } catch (e) {
    return res.json({
      status: false,
      error: e.message
    });
  }
});

// 🔥 ADMIN LIVE USERS
app.get("/admin/live-users", async (req, res) => {
  try {
    const snapshot = await db.collection("liveUsers").get();

    let users = [];

    snapshot.forEach(doc => {
      users.push(doc.data());
    });

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
