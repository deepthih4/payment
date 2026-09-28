const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;


// ===============================
// SUPABASE
// ===============================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase environment variables missing");
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);


// ===============================
// PAYMENT PAGE
// ===============================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


// ===============================
// CREATE PAYMENT
// ===============================

app.post("/api/payment/create", async (req, res) => {

  try {

    const amount = Number(req.body.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });

    }


    const orderId =
      "CEZOO_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();


    // SAVE TO SUPABASE

    const { data, error } =
      await supabase
        .from("upi_orders")
        .insert({
          order_id: orderId,
          amount: amount,
          status: "PENDING"
        })
        .select()
        .single();


    if (error) {

      console.error(
        "Supabase insert error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to create payment"
      });

    }


    return res.json({

      success: true,

      orderId: orderId,

      amount: amount,

      status: "PENDING"

    });


  }

  catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});


// ===============================
// PAYMENT STATUS
// ===============================

app.get(
  "/api/payment/status/:orderId",
  async (req, res) => {

    try {

      const { data, error } =
        await supabase
          .from("upi_orders")
          .select(
            "order_id,amount,status,transaction_id"
          )
          .eq(
            "order_id",
            req.params.orderId
          )
          .single();


      if (error || !data) {

        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });

      }


      res.json({

        success: true,

        orderId: data.order_id,

        amount: data.amount,

        status: data.status,

        transactionId:
          data.transaction_id || null

      });


    }

    catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
);


// ===============================
// SERVER
// ===============================

app.listen(PORT, () => {

  console.log(
    `CEZOO Payment Server running on port ${PORT}`
  );

});
