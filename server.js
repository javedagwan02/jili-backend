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

// JILI GAME
app.get("/start-game", async (req,res)=>{

  const userId = req.query.userId || "12345";

  try{

    const response = await axios.post(
      "https://al.gamblly-api.com/b24d2/game/launch", // 🔥 suffix use hua
      {
        api_key: "fecfaa08d7aCodeHub944b04ac2cf59a", // 🔥 teri real key
        user_id: userId,
        game_code: "fortune_gems" // test game
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
