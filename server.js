const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// index.html serve cheyyadaniki
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;


// HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// TEST PAYMENT CREATE API
app.post("/api/payment/create", (req, res) => {

  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment amount"
    });
  }

  const orderId = "CEZOO" + Date.now();

  res.json({
    success: true,
    orderId,
    amount,
    status: "PENDING"
  });

});


app.listen(PORT, () => {
  console.log(`CEZOO Payment Server running on port ${PORT}`);
});