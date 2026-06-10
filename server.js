const sessionRef = db.collection("v2Sessions").doc(userId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.json({
        success: true,
        message: "No active session"
      });
    }

    const session = sessionDoc.data();

    if (session.status !== "open") {
      return res.json({
        success: true,
        message: "Already settled"
      });
    }

    const payload = {
      agency_uid: fecfaa08d7aCodeHub944b04ac2cf59a,
      member_account: session.username,
      transfer_id: session.transferId,
      home_url: "https://2xwin.online",
      currency_code: "INR",
      language: "en",
      platform: "web",
      timestamp: Date.now()
    };

    console.log("💸 WITHDRAW PAYLOAD:");
    console.log(payload);

    const response = await api.post(
      "https://game.gambllyapi.com/production/v2/getWithdraw.php",
      payload,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    console.log("💸 WITHDRAW RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    const amount = Number(
      response.data.amount ||
      response.data.payload?.amount ||
      response.data.payload?.balance ||
      0
    );

    const finalAmount = Number(amount.toFixed(2));

    const userSnap = await db.collection("users")
      .where("email", "==", userId)
      .limit(1)
      .get();

    if (!userSnap.empty) {
      await userSnap.docs[0].ref.update({
        balance: finalAmount
      });
    }

    await sessionRef.update({
      status: "settled",
      settledAmount: finalAmount,
      settledAt: Date.now(),
      withdrawResponse: response.data
    });

    return res.json({
      success: true,
      balance: finalAmount
    });

  } catch (e) {

    console.log("❌ SETTLE ERROR");
    console.log(e.response?.data || e.message);

    return res.json({
      success: false,
      error: e.response?.data || e.message
    });

  }

});

// 🔥 ADMIN LIVE USERS
app.get("/admin/live-users", async (req, res) => {

  try {

    const snapshot = await db.collection("liveUsers").get();

    let users = [];

    snapshot.forEach(doc => {
      users.push(doc.data());
    });

    return res.json(users);

  } catch (e) {

    return res.json({
      success: false,
      error: e.message
    });

  }

});

// ✅ SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 V2 Server started on port " + PORT);
});
