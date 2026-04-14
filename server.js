const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ TEST ROUTE
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});

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

    // 🔥 DIRECT OPEN
    res.redirect(gameUrl);

  }catch(e){

    console.log("ERROR:", e.response?.data || e.message);

    res.json({
      error:"Game launch failed",
      details: e.response?.data || e.message
    });
  }

});

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server started on port " + PORT);
});
