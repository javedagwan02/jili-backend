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

// ✅ TEST ROUTE
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});


// ✅ GAME LAUNCH
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId || "12345";

  try{
    const snapshot = await db.collection("users")
.where("email","==",userId)
.get();

let balance = 0;

snapshot.forEach(doc=>{
  balance = Number(doc.data().balance || 0);
});
console.log("BALANCE SENT:", balance);
    const response = await axios.post(
  "https://game.gamblly-api.com/v1/gameLaunch.php",
  {
    member_account: userId,
    game_uid: "a990de177577a2e6a889aaac5f57b429",
    api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
    currency_code: "INR",
    language: "en",
    platform: 2,
    home_url: "https://2xwin.online",

    // 🔥 ADD THIS
    credit_amount: balance.toString()
    transfer_id: Date.now().toString()
  }
);

    const gameUrl = response.data.payload.game_launch_url;

    // 🔥 DIRECT GAME OPEN
    res.redirect(gameUrl);

  }catch(e){

    console.log("ERROR:", e.response?.data || e.message);

    res.json({
      error:"Game launch failed",
      details: e.response?.data || e.message
    });
  }

});


// 🔥 CALLBACK (WALLET UPDATE)
app.post("/callback", async (req, res) => {

  console.log("🔥 CALLBACK:", req.body);

  const data = req.body;

  const userEmail = data.player_uid;
  const action = data.action;

  const betAmount = Number(data.bet_amount || 0);
  const winAmount = Number(data.win_amount || 0);

  const snapshot = await db.collection("users")
    .where("email","==",userEmail)
    .get();

  let newBalance = 0;

  if(snapshot.empty){
    return res.json({ status:false });
  }

  const doc = snapshot.docs[0];

  let balance = Number(doc.data().balance || 0);

  if(action === "bet"){
    balance -= betAmount;
    console.log("❌ BET:", betAmount);
  }

  if(action === "win"){
    balance += winAmount;
    console.log("✅ WIN:", winAmount);
  }

  newBalance = balance;

  await doc.ref.update({ balance });

  res.json({
    status: true,
    balance: newBalance
  });

});

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
