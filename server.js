const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.get("/callback", (req, res) => {
  console.log("GET CALLBACK");
  res.json({
    success: true,
    message: "Callback Active"
  });
});

app.post("/callback", (req, res) => {
  console.log("POST CALLBACK HIT");
  console.log(req.body);

  return res.json({
    status: true,
    balance: 1000
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Started");
});
