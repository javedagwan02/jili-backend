const express = require("express");
const axios = require("axios");
const cors = require("cors");
const qs = require("qs");

// 🔥 EXPRESS
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 AXIOS
const api = axios.create({
  timeout: 15000
});

// 🔥 FIREBASE ADMIN
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ✅ TEST ROUTES
app.get("/", (req, res) => {
  res.send("Backend chal raha hai ✅");
});

app.get("/ping", (req, res) => {
  res.send("OK");
});

// 🔥 START GAME
app.get("/start-game", async (req, res) => {

  console.log("🎮 START GAME HIT");

  const userId = req.query.userId;
  const gameId = req.query.gameId;

  console.log("👤 USER:", userId);
  console.log("🎰 GAME:", gameId);

  if (!userId || !gameId) {

    return res.json({
      success: false,
      error: "Missing userId or gameId"
    });

  }

  try {

    // 🔥 FIND USER
    const snapshot = await db
      .collection("users")
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

    let balance = parseFloat(
      Number(data.balance || 0).toFixed(2)
    );

    // 🔥 SAFE USERNAME
    let username;

    if (data.username) {

      username = data.username;

    } else {

      username = data.email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      await doc.ref.update({
        username: username
      });

    }

    console.log("🧑 USERNAME:", username);
    console.log("💰 BALANCE:", balance);

    // 🔥 SAVE LIVE USER
    await db.collection("liveUsers")
      .doc(userId)
      .set({
        email: userId,
        username: username,
        gameId: gameId,
        status: "online",
        startTime: Date.now()
      });

    // 🔥 PROVIDER REQUEST
    const payload = {
  member_account: username,
  game_uid: gameId,
  api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
  currency_code: "INR",
  language: "en",
  platform: 1,
  home_url: "https://2xwin.online",
  credit_amount: balance.toFixed(2),
  transfer_id: Date.now().toString()
};

    console.log("📤 PAYLOAD:");
    console.log(payload);

    const response = await api.post(

      "https://game.gambllyapi.com/production/v1/gameLaunch.php",

      qs.stringify(payload),

      {
        headers: {
          "Content-Type":
          "application/x-www-form-urlencoded"
        }
      }

    );

    console.log("📥 PROVIDER RESPONSE:");
    console.log(
      JSON.stringify(response.data, null, 2)
    );

    // 🔥 SUCCESS CHECK
    if (
      !response.data ||
      !response.data.success ||
      !response.data.game_url
    ) {

      return res.json({
        success: false,
        error: "Provider failed",
        providerResponse: response.data
      });

    }

    // ✅ SEND URL
    return res.json({
      success: true,
      url: response.data.game_url
    });

  } catch (e) {

    console.log("❌ START GAME ERROR");

    if (e.response) {
      console.log(e.response.data);
    } else {
      console.log(e.message);
    }

    return res.json({
      success: false,
      error: "Game launch failed",
      details:
      e.response?.data || e.message
    });

  }

});

app.all("/callback", (req, res, next) => {
  console.log("🚨 CALLBACK ROUTE HIT");
  console.log("METHOD:", req.method);
  next();
});
// 🔥 CALLBACK
app.post("/callback", async (req, res) => {

  console.log("🔥 CALLBACK HIT");
  console.log(
    JSON.stringify(req.body, null, 2)
  );

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

    // 🔥 FIND USER
    const snapshot = await db.collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty) {

      console.log("❌ USER NOT FOUND");

      return res.json({
        status: false
      });

    }

    const doc = snapshot.docs[0];

    let currentBalance = Number(
      doc.data().balance || 0
    );

    console.log(
      "💰 OLD BALANCE:",
      currentBalance
    );

    // 🔥 BET AMOUNT
    const betAmount = parseFloat(

      data.bet_amount ||

      data.amount ||

      data.bet ||

      0

    );

    // 🔥 WIN AMOUNT
    const winAmount = parseFloat(

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

    // 🔥 FINAL BALANCE
    let newBalance =
      currentBalance - betAmount + winAmount;

    // 🔥 FIX DECIMAL
    newBalance = parseFloat(
      newBalance.toFixed(2)
    );

    // ❌ NEGATIVE FIX
    if (newBalance < 0) {
      newBalance = 0;
    }

    // 🔥 SAVE BALANCE
    await doc.ref.update({
      balance: newBalance
    });

    console.log(
      "✅ NEW BALANCE:",
      newBalance
    );

    // 🔥 UPDATE LIVE STATUS
    await db.collection("liveUsers")
      .doc(doc.data().email)
      .set({

        lastSeen: Date.now(),
        status: "offline"

      }, { merge: true });

    return res.json({

      status: true,
      balance: newBalance

    });

  } catch (e) {

    console.log("❌ CALLBACK ERROR");
    console.log(e.message);

    return res.json({
      status: false,
      error: e.message
    });

  }

});

// 🔥 ADMIN LIVE USERS
app.get("/admin/live-users", async (req, res) => {

  try {

    const snapshot =
      await db.collection("liveUsers").get();

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

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "🚀 Server started on port " + PORT
  );

});

                  
