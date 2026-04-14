const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// TEST
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});

// GAME LAUNCH
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId || "user123";

  try{

    const response = await axios.post(
      "https://gamblly-api.com/v1/gameLaunch.php", // ✅ correct endpoint (try this)
      {
        member_account: userId,
        game_uid: "fortune_gems", // 👉 game catalog se lena
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a",
        home_url: "https://2xwin.online",
        platform: 2
      }
    );

    res.json(response.data);

  }catch(e){

    console.log("FULL ERROR:", e.response?.data || e.message);

    res.json({
      error:"Game launch failed",
      details: e.response?.data || e.message
    });
  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server started on port " + PORT);
});
