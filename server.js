const express = require("express");
const axios = require("axios");
const cors = require("cors");
const qs = require("qs");

// 🔥 AXIOS
const api = axios.create({
  timeout: 7000
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

app.get("/ping", (req,res)=>{
  res.send("OK");
});

// 🔥 GAME LAUNCH
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId;
  const gameId = req.query.gameId;

  if(!userId || !gameId){
    return res.json({
      error:"Missing userId or gameId"
    });
  }

  try{

    // 🔥 USER FIND
    const snapshot = await db.collection("users")
      .where("email","==",userId)
      .get();

    if(snapshot.empty){
      return res.json({
        error:"User not found"
      });
    }

    const doc = snapshot.docs[0];
    let data = doc.data();

    let balance = Number(data.balance || 0);

    // 🔥 AUTO USERNAME
    if(!data.username){

      const autoUsername =
        data.email.split("@")[0] +
        Math.floor(1000 + Math.random() * 9000);

      await doc.ref.update({
        username:autoUsername
      });

      data.username = autoUsername;
    }

    const username = data.username;

    // 🔥 LIVE USER SAVE
    await db.collection("liveUsers")
      .doc(userId)
      .set({
        email:userId,
        gameId:gameId,
        username:username,
        status:"online",
        startTime:Date.now()
      });

    // 🔥 PROVIDER API CALL
    const response = await api.post(

      "https://game.gamblly-api.com/production/v1/gameLaunch.php",

      qs.stringify({

        member_account: username,
        game_uid: gameId,
        credit_amount: String(balance),
        currency_code: "INR",
        language: "en",
        platform: 2,
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        home_url: "https://2xwin.online",
        transfer_id: Date.now().toString()

      }),

      {
        headers:{
          "Content-Type":
          "application/x-www-form-urlencoded"
        }
      }

    );

    console.log("🔥 PROVIDER RESPONSE:");
    console.log(response.data);

    const gameUrl = response.data?.game_url;

    if(!gameUrl){

      return res.json({
        error:"Game URL not received",
        providerResponse: response.data
      });

    }

    // 🔥 REDIRECT GAME
    return res.redirect(gameUrl);

  }catch(e){

    console.log("❌ ERROR:");

    if(e.response){
      console.log(e.response.data);
    }else{
      console.log(e.message);
    }

    return res.json({
      error:"Game launch failed"
    });
  }

});

// 🔥 CALLBACK
app.post("/callback", async (req,res)=>{

  console.log(
    JSON.stringify(req.body,null,2)
  );

  try{

    const data = req.body;

    const username = data.player_uid;
    const action = data.action;

    const snapshot = await db.collection("users")
      .where("username","==",username)
      .get();

    if(snapshot.empty){

      return res.json({
        status:false
      });

    }

    const doc = snapshot.docs[0];

    let balance = Number(
      doc.data().balance || 0
    );

    console.log("🔥 ACTION:", action);

    // 🔻 BET
    if(action === "bet"){

      const betAmount = Number(
        data.bet_amount || 0
      );

      balance -= betAmount;

      console.log("❌ BET:", betAmount);
    }

    // 🔥 WIN
    if(action === "win"){

      const winAmount = Number(
        data.win_amount || 0
      );

      balance += winAmount;

      console.log("✅ WIN:", winAmount);
    }

    // 🔥 UPDATE BALANCE
    await doc.ref.update({
      balance: balance
    });

    // 🔥 USER OFFLINE
    await db.collection("liveUsers")
      .doc(doc.data().email)
      .update({
        status:"offline",
        lastSeen:Date.now()
      });

    return res.json({
      status:true,
      balance:balance
    });

  }catch(e){

    console.log("❌ CALLBACK ERROR:");

    if(e.response){
      console.log(e.response.data);
    }else{
      console.log(e.message);
    }

    return res.json({
      status:false
    });
  }

});

// 🔥 ADMIN LIVE USERS API
app.get("/admin/live-users", async (req,res)=>{

  const snapshot =
    await db.collection("liveUsers").get();

  let users = [];

  snapshot.forEach(doc=>{
    users.push(doc.data());
  });

  res.json(users);

});

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log(
    "🚀 Server started on port " + PORT
  );
});
