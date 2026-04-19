const express = require("express");
const axios = require("axios");
const cors = require("cors");
const api = axios.create({
  timeout: 7000 // 🔥 7 sec max
});
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

// ✅ TEST ROUTE
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});

app.get("/ping", (req, res) => {
  res.send("OK");
});
// 🔥 GAME LAUNCH (MULTI GAME)
const crypto = require("crypto");

app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId;
  const gameId = req.query.gameId;

  if(!userId || !gameId){
    return res.json({ error: "Missing userId or gameId" });
  }

  try{

    const snapshot = await db.collection("users")
      .where("email","==",userId)
      .get();

    if(snapshot.empty){
      return res.json({ error: "User not found" });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    let username = data.username;

    // 🔥 agar username nahi hai to bana de
    if(!username){
      username = data.email.split("@")[0] + Math.floor(1000 + Math.random()*9000);
      await docSnap.ref.update({ username });
    }

    // 🔥 SECRET KEY
    const secret = "5d13715ccb2a3fa6a43523f2e2fd7cbc";

    // 🔥 PAYLOAD
    const payload = {
      merchant_code: "2xwin_api",
      user_id: username,
      game_code: gameId,
      currency: "INR",
      timestamp: Date.now()
    };

    // 🔥 SIGNATURE
    const signString = Object.values(payload).join("");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signString)
      .digest("hex");

    // 🔥 API CALL
    const response = await axios.post(
      "https://api-proxy.h5gaming.biz/game/launch",
      {
        ...payload,
        sign: signature
      }
    );

    const gameUrl = response.data?.data?.game_url;

    if(!gameUrl){
      return res.json({ error:"Game URL not received" });
    }

    // 🔥 GAME OPEN
    return res.redirect(gameUrl);

  }catch(e){
    console.log("❌ ERROR:", e.message);
    return res.json({ error:"Game launch failed" });
  }

});
  

// 🔥 CALLBACK (FINAL FIXED)
app.post("/callback", async (req, res) => {

  console.log("🔥 CALLBACK:", req.body);

  try{

    const data = req.body;

    const username = data.player_uid;
    const action = data.action;

    const snapshot = await db.collection("users")
      .where("username","==",username)
      .get();

    if(snapshot.empty){
      return res.json({ status:false });
    }

    const doc = snapshot.docs[0];
    let balance = Number(doc.data().balance || 0);

    console.log("🔥 ACTION:", action);

    // 🔻 NORMAL BET
    if(action === "bet"){
      const betAmount = Number(data.amount || data.bet_amount || 0);
      balance -= betAmount;

      console.log("❌ BET:", betAmount);
    }

    // 🔥 BET + WIN TOGETHER (MOST IMPORTANT FIX)
    if(action === "bet_win"){
      const bet = Number(data.bet_amount || data.amount || 0);
      const win = Number(data.win_amount || 0);

      const profit = win - bet;

      balance += profit;

      console.log("🔥 BET:", bet);
      console.log("🔥 WIN:", win);
      console.log("🔥 PROFIT:", profit);
    }

    // 🔺 NORMAL WIN / SETTLE
    if(
      action === "settle" ||
      action === "win" ||
      action === "credit" ||
      action === "win_settle"
    ){
      const winAmount = Number(data.payout_amount || data.win_amount || 0);

      balance += winAmount;

      console.log("✅ WIN:", winAmount);
    }

    await doc.ref.update({ balance });

    res.json({
      status: true,
      balance: balance
    });

  }catch(e){
    console.log("CALLBACK ERROR:", e.message);
    res.json({ status:false });
  }

});


// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
