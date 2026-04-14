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
      apiKey: "234d9bfc3c5CodeHub94045e3c0b1515",
      userId: "12345",
      game: "jili"
    });

    res.json(response.data);

  catch(e){
  console.log("FULL ERROR:", e.response?.data || e.message);

  res.json({
    error:"Game launch failed",
    details: e.response?.data || e.message
  });
  }

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server started on port " + PORT);
});
