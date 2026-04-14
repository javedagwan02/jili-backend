const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

// ✅ TEST
app.get("/", (req,res)=>{
  res.send("Backend chal raha hai ✅");
});

// ✅ JILI GAME LAUNCH
app.get("/start-game", async (req,res)=>{

  try{

    const response = await axios.post("https://api.gamblly-api.com/launch", {
      apiKey: "APNI_API_KEY_YHA_DAL",
      userId: "12345",
      game: "jili"
    });

    res.json(response.data);

  }catch(e){
    res.json({error:"Game launch failed"});
  }

});

app.listen(3000, ()=>{
  console.log("Server started");
});
