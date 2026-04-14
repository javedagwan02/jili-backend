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

  console.log("🔥 CALLBACK AAYA:", req.body);

  const data = req.body;

  try {

    const userEmail = data.member_account;
    const amount = Number(data.amount || 0);

    // 🔍 USER FIND FIREBASE
    const snapshot = await db.collection("users")
      .where("email","==",userEmail)
      .get();

    if(snapshot.empty){
      console.log("❌ USER NOT FOUND:", userEmail);
      return res.json({ status: "user_not_found" });
    }

    snapshot.forEach(async (doc) => {

      let balance = doc.data().balance || 0;

      // ❌ BET → MINUS
      if(data.type === "bet"){
        balance -= amount;
        console.log("❌ BET:", amount);
      }

      // ✅ WIN → ADD
      if(data.type === "win"){
        balance += amount;
        console.log("✅ WIN:", amount);
      }

      await doc.ref.update({ balance });

      console.log("💰 UPDATED BALANCE:", balance);

    });

    res.json({ status: "success" });

  } catch (e) {

    console.log("❌ CALLBACK ERROR:", e.message);

    res.json({ status: "error" });

  }

});


// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
