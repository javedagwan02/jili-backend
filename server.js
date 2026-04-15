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


// 🔥 GAME LAUNCH (MULTI GAME)
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId;
  const gameId = req.query.gameId; // 🔥 NEW

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

    const doc = snapshot.docs[0];
    let data = doc.data();

    let balance = Number(data.balance || 0);

    // 🔥 AUTO USERNAME FIX
    if(!data.username){
      const autoUsername =
        data.email.split("@")[0] + Math.floor(1000 + Math.random() * 9000);

      await doc.ref.update({ username: autoUsername });
      data.username = autoUsername;

      console.log("⚡ Auto username created:", autoUsername);
    }

    const username = data.username;

    console.log("🔥 FINAL REQUEST:", {
      member_account: username,
      balance,
      gameId
    });

    // 🔥 API CALL (DYNAMIC GAME)
    const response = await axios.post(
      "https://game.gamblly-api.com/production/v1/gameLaunch.php",
      {
        member_account: username,
        game_uid: gameId, // 🔥 MAIN CHANGE
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        currency_code: "INR",
        language: "en",
        platform: 1,
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

    const username = data.player_uid;
    const action = data.action;

    // 🔻 BET
    const betAmount = Number(data.bet_amount || data.amount || 0);

    // 🔺 WIN (NO amount fallback)
    const winAmount = Number(
      data.payout_amount || 
      data.win_amount || 
      0
    );

    console.log("🔥 ACTION:", action);
    console.log("🔥 BET:", betAmount);
    console.log("🔥 WIN:", winAmount);

    const snapshot = await db.collection("users")
      .where("username","==",username)
      .get();

    if(snapshot.empty){
      return res.json({ status:false });
    }

    const doc = snapshot.docs[0];
    let balance = Number(doc.data().balance || 0);

    if(action === "bet"){
      balance -= betAmount;
      console.log("❌ BET DONE");
    }

    if(
      action === "win" ||
      action === "settle" ||
      action === "credit" ||
      action === "win_settle"
    ){
      balance += winAmount;
      console.log("✅ WIN ADDED");
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
