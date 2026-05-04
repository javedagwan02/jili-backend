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

    const doc = snapshot.docs[0];
    let data = doc.data();

    let balance = Number(data.balance || 0);

    // 🔥 USERNAME AUTO
    if(!data.username){
      const autoUsername =
        data.email.split("@")[0] + Math.floor(1000 + Math.random() * 9000);

      await doc.ref.update({ username: autoUsername });
      data.username = autoUsername;
    }

    const username = data.username;
    // 🔥 SAVE LIVE STATUS
await db.collection("liveUsers").doc(userId).set({
  email: userId,
  gameId: gameId,
  username: username,
  status: "online",
  startTime: Date.now()
});

    // 🔥 FAST API CALL
    const response = await api.post(
      "https://game.gamblly-api.com/production/v1/gameLaunch.php",
      {
        member_account: username,
        game_uid: gameId,
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        currency_code: "INR",
        language: "en",
        platform: 1,
        home_url: "https://2xwin.online",
        credit_amount: balance,
        transfer_id: Date.now().toString()
      }
    );

    const gameUrl = response.data?.game_url;

    if (!gameUrl) {
      return res.json({ error: "Game URL not received" });
    }

    return res.redirect(gameUrl);

  }catch(e){

    console.log("❌ ERROR:", e.message);

    // 🔥 SMART ERROR HANDLE
    if(e.code === "ECONNABORTED"){
      return res.json({ error:"Server slow, try again" });
    }

    return res.json({
      error:"Game server down"
    });
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
// 🔻 USER OFFLINE UPDATE
await db.collection("liveUsers").doc(doc.data().email).update({
  status: "offline",
  lastSeen: Date.now()
});
    res.json({
      status: true,
      balance: balance
    });

  }catch(e){
    console.log("CALLBACK ERROR:", e.message);
    res.json({ status:false });
  }

});

// 🔥 ADMIN LIVE USERS API
app.get("/admin/live-users", async (req,res)=>{

  const snapshot = await db.collection("liveUsers").get();

  let users = [];

  snapshot.forEach(doc=>{
    users.push(doc.data());
  });

  res.json(users);
});
const crypto = require("crypto");

// 🔥 CREATE ORDER
app.post("/create-order", async (req,res)=>{

  try{

    const { amount, email } = req.body;

    if(!amount || !email){
      return res.json({error:"Missing data"});
    }

    const order_id = "ORD" + Date.now();

    // 🔥 SIGN
    let signStr =
      "amount=" + amount +
      "&app_id=YD5066" +
      "&order_id=" + order_id +
      "&trade_type=INRUPI" +
      "&key=vyZQ5rNlu9SobI6h27TXMtK53be54DKM";

    const sign = crypto.createHash("md5").update(signStr).digest("hex");

    const response = await axios.post(
      "https://www.lg-pay.com/api/order/create",
      new URLSearchParams({
        app_id: "YD5066",
        trade_type: "INRUPI",
        order_id: order_id,
        amount: amount,
        notify_url: "http://187.127.162.97:3000/payment-callback",
        return_url: "https://2xwin.online",
        attach: email,
        sign: sign
      }),
      {
        headers:{
          "Content-Type":"application/x-www-form-urlencoded"
        }
      }
    );

    const data = response.data;

    if(data.status == 1){
      return res.json({
        payUrl: data.data.pay_url
      });
    }else{
      return res.json({
        error: data.msg
      });
    }

  }catch(e){
    console.log(e.message);
    res.json({error:"Server error"});
  }

});


// 🔥 PAYMENT CALLBACK (AUTO BALANCE)
app.post("/payment-callback", async (req,res)=>{

  try{

    console.log("🔥 CALLBACK:", req.body);

    const { amount, status, attach } = req.body;

    if(status != 1){
      return res.send("fail");
    }

    const snapshot = await db.collection("users")
      .where("email","==",attach)
      .get();

    if(snapshot.empty){
      return res.send("user not found");
    }

    const doc = snapshot.docs[0];
    let balance = Number(doc.data().balance || 0);

    await doc.ref.update({
      balance: balance + Number(amount)
    });

    res.send("success");

  }catch(e){
    console.log(e.message);
    res.send("fail");
  }

});
// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("🚀 Server started on port " + PORT);
});
