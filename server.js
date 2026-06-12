const express = require("express");
const axios = require("axios");
const cors = require("cors");
const qs = require("qs");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const api = axios.create({
  timeout: 15000
});

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

    let balance = Number(Number(data.balance || 0).toFixed(2));

    // 🔥 SAFE USERNAME
    let username = data.username;

    if (!username) {
      username = String(data.email || userId)
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
    await db.collection("liveUsers").doc(userId).set(
      {
        email: userId,
        username: username,
        gameId: gameId,
        status: "online",
        startTime: Date.now(),
        balance: balance
      },
      { merge: true }
    );

    // 🔥 PROVIDER REQUEST
    const payload = {
  member_account: username,
  game_uuid: gameId,
  api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
  currency_code: "INR",
  language: "en",
  platform: 2,
  home_url: "https://2xwin.online",
  credit_amount: balance.toFixed(2),
  transfer_id: `launch_${Date.now()}`
};

    console.log("📤 PAYLOAD:");
    console.log(payload);

    const response = await api.post(
      "https://game.gambllyapi.com/production/v1/gameLaunch.php",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📥 PROVIDER RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

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
      details: e.response?.data || e.message
    });
  }
});

// 🔥 CALLBACK
app.post("/callback", async (req, res) => {
  console.log("🔥 CALLBACK HIT");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const data = req.body;

    const username =
      data.player_uuid ||   // ✅ fixed
      data.player_uid ||
      data.member_account ||
      data.username;

    if (!username) {
      return res.json({
        status: false,
        error: "Username missing",
        balance: 0
      });
    }

    // 🔥 FIND USER
    const snapshot = await db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("❌ USER NOT FOUND:", username);

      return res.json({
        status: false,
        error: "User not found",
        balance: 0
      });
    }

    const doc = snapshot.docs[0];
    const user = doc.data();

    let currentBalance = Number(user.balance || 0);

    const action = String(data.action || "").toLowerCase();

    const betAmount = Number(
      data.bet_amount ??
      data.amount ??
      data.bet ??
      0
    );

    const winAmount = Number(
      data.win_amount ??
      data.payout_amount ??
      data.payoff ??
      data.win ??
      data.payout ??
      data.prize ??
      0
    );

    console.log("👤 USERNAME:", username);
    console.log("🎯 ACTION:", action);
    console.log("💰 OLD BALANCE:", currentBalance);
    console.log("🎯 BET:", betAmount);
    console.log("🏆 WIN:", winAmount);

    let newBalance = currentBalance;

    if (action === "bet") {
      if (currentBalance < betAmount) {
        console.log("❌ INSUFFICIENT BALANCE", {
          currentBalance,
          betAmount
        });

        return res.json({
          status: false,
          balance: Number(currentBalance.toFixed(2))
        });
      }

      newBalance = currentBalance - betAmount;

    } else if (action === "win") {
      newBalance = currentBalance + winAmount;

    } else if (
      action === "refund" ||
      action === "cancel" ||
      action === "rollback"
    ) {
      newBalance = currentBalance + betAmount;

    } else {
      // fallback if provider sends mixed payload
      if (betAmount > 0 || winAmount > 0) {
        const tentative = currentBalance - betAmount + winAmount;

        if (tentative < 0) {
          return res.json({
            status: false,
            balance: Number(currentBalance.toFixed(2))
          });
        }

        newBalance = tentative;
      }
    }

    newBalance = Number(newBalance.toFixed(2));

    if (newBalance < 0) {
      newBalance = 0;
    }

    // 🔥 SAVE BALANCE
    await doc.ref.update({
      balance: newBalance,
      lastGameAction: action || null,
      lastTransferId: data.transfer_id || null,
      lastUpdatedAt: Date.now()
    });

    console.log("✅ NEW BALANCE:", newBalance);

    // 🔥 UPDATE LIVE STATUS
    await db.collection("liveUsers")
      .doc(user.email)
      .set(
        {
          lastSeen: Date.now(),
          status: "online"
        },
        { merge: true }
      );

    return res.json({
      status: true,
      balance: newBalance
    });

  } catch (e) {
    console.log("❌ CALLBACK ERROR");
    console.log(e.message);

    return res.json({
      status: false,
      error: e.message,
      balance: 0
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

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server started on port " + PORT);
});
