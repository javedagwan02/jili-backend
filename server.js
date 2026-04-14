const express = require("express");
const axios = require("axios");
const cors = require("cors");

// 🔥 FIREBASE ADMIN
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());


// ✅ TEST
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});


// 🔥 START GAME (V2 FLOW)
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId;

  if(!userId){
    return res.json({ error: "userId missing" });
  }

  try{

    const snapshot = await db.collection("users")
      .where("email","==",userId)
      .get();

    if(snapshot.empty){
      return res.json({ error: "User not found" });
    }

    const doc = snapshot.docs[0];
    let balance = Number(doc.data().balance || 0);

    console.log("💰 USER BALANCE:", balance);

    // 🔥 STEP 1: TRANSFER (LIMITED AMOUNT)
    let amount = Math.min(balance, 200); // 🔥 safe limit

    await axios.post(
      "https://game.gamblly-api.com/production/v2/transfer",
      {
        member_account: userId,
        amount: amount,
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a"
      }
    );

    console.log("✅ TRANSFER DONE:", amount);

    // 🔥 STEP 2: GAME LAUNCH
    const response = await axios.post(
      "https://game.gamblly-api.com/production/v2/gameLaunch.php",
      {
        member_account: userId,
        game_uid: "a990de177577a2e6a889aaac5f57b429",
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        currency_code: "INR",
        language: "en",
        platform: 2,
        home_url: "https://2xwin.online"
      }
    );

    const gameUrl = response.data?.payload?.game_launch_url;

    if(!gameUrl){
      return res.json({ error: "Game URL not received", data: response.data });
    }

    res.redirect(gameUrl);

  }catch(e){
    console.log("❌ ERROR:", e.response?.data || e.message);

    res.json({
      error:"Game launch failed",
      details: e.response?.data || e.message
    });
  }

});


// 🔥 CALLBACK (BET/WIN)
app.post("/callback", async (req,res)=>{

  console.log("🔥 CALLBACK:", req.body);

  try{

    const data = req.body;

    const userEmail = data.player_uid;
    const action = data.action;

    const betAmount = Number(data.bet_amount || 0);
    const winAmount = Number(data.win_amount || 0);

    const snapshot = await db.collection("users")
      .where("email","==",userEmail)
      .get();

    if(snapshot.empty){
      return res.json({ status:false });
    }

    const doc = snapshot.docs[0];
    let balance = Number(doc.data().balance || 0);

    if(action === "bet"){
      balance -= betAmount;
    }

    if(action === "win"){
      balance += winAmount;
    }

    await doc.ref.update({ balance });

    res.json({
      status:true,
      balance: balance
    });

  }catch(e){
    res.json({ status:false });
  }

});


// 🔥 WITHDRAW (IMPORTANT)
app.get("/withdraw", async (req,res)=>{

  const userId = req.query.userId;

  try{

    const withdrawRes = await axios.post(
      "https://game.gamblly-api.com/production/v2/getWithdraw",
      {
        member_account: userId,
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a"
      }
    );

    const amount = Number(withdrawRes.data.amount || 0);

    const snapshot = await db.collection("users")
      .where("email","==",userId)
      .get();

    if(!snapshot.empty){
      const doc = snapshot.docs[0];
      await doc.ref.update({ balance: amount });
    }

    res.json({ success:true, amount });

  }catch(e){
    res.json({ success:false });
  }

});


// 🚀 START
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
