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

// 🔥 GAME LAUNCH
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
    const data = doc.data();

    let balance = Number(data.balance || 0);
    const username = data.username;

    // 🔥 CHECK USERNAME
    if(!username){
      return res.json({ error: "Username missing in Firebase" });
    }

    // 🔥 DEBUG
    console.log("🔥 FINAL REQUEST:", {
      member_account: username,
      balance
    });

    // 🔥 API CALL
    const response = await axios.post(
      "https://game.gamblly-api.com/production/v1/gameLaunch.php",
      {
        member_account: username,
        game_uid: "a990de177577a2e6a889aaac5f57b429",
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        currency_code: "INR",
        language: "en",
        platform: 1, // 🔥 FIXED
        home_url: "https://2xwin.online",

        credit_amount: balance.toString(),
        transfer_id: Date.now().toString()
      }
    );

    console.log("🔥 API RESPONSE:", response.data);

const gameUrl = response.data?.game_url;

if (!gameUrl) {
  console.log("❌ FULL RESPONSE:", response.data);
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

// 🔥 CALLBACK (BET / WIN)
app.post("/callback", async (req, res) => {

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
      status: true,
      balance: balance
    });

  }catch(e){
    console.log("CALLBACK ERROR:", e.message);

    res.json({
      status:false
    });
  }

});

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
