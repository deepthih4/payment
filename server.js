const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;


// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID;

const MERCHANT_NAME =
  process.env.MERCHANT_NAME || "CEZOO";


// ==========================================
// CHECK ENV
// ==========================================

if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL missing");
}

if (!SUPABASE_SECRET_KEY) {
  console.error("❌ SUPABASE_SECRET_KEY missing");
}

if (!MERCHANT_UPI_ID) {
  console.error("❌ MERCHANT_UPI_ID missing");
}


// ==========================================
// SUPABASE
// ==========================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


// ==========================================
// HEALTH
// ==========================================

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    message: "CEZOO Payment Server Running"
  });

});


// ==========================================
// CREATE PAYMENT
// ==========================================

app.post(
  "/api/payment/create",
  async (req, res) => {

    try {

      const amount =
        Number(req.body.amount);


      // VALIDATE AMOUNT

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid payment amount"
        });

      }


      if (!MERCHANT_UPI_ID) {

        return res.status(500).json({
          success: false,
          message: "Merchant UPI ID not configured"
        });

      }


      // UNIQUE ORDER ID

      const random =
        crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase();

      const orderId =
        `CEZOO_${Date.now()}_${random}`;


      // SAVE PAYMENT TO SUPABASE

      const {
        data,
        error
      } = await supabase
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


      // ======================================
      // GENERIC UPI PAYMENT URL
      // ======================================

      const params =
        new URLSearchParams({

          pa: MERCHANT_UPI_ID,

          pn: MERCHANT_NAME,

          am: amount.toFixed(2),

          cu: "INR",

          tr: orderId,

          tn: `CEZOO ${orderId}`

        });


      const upiUrl =
        `upi://pay?${params.toString()}`;


      // SEND TO FRONTEND

      return res.json({

        success: true,

        orderId: orderId,

        amount: amount,

        status: "PENDING",

        upiUrl: upiUrl

      });


    }

    catch (error) {

      console.error(
        "Create payment error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Payment service unavailable"

      });

    }

  }
);


// ==========================================
// CHECK PAYMENT STATUS
// ==========================================

app.get(
  "/api/payment/status/:orderId",
  async (req, res) => {

    try {

      const orderId =
        req.params.orderId;


      const {
        data,
        error
      } = await supabase
        .from("upi_orders")
        .select(
          "order_id,amount,status,transaction_id"
        )
        .eq(
          "order_id",
          orderId
        )
        .single();


      if (error || !data) {

        console.error(
          "Payment status error:",
          error
        );

        return res.status(404).json({

          success: false,

          message:
            "Payment not found"

        });

      }


      return res.json({

        success: true,

        orderId:
          data.order_id,

        amount:
          Number(data.amount),

        status:
          data.status,

        transactionId:
          data.transaction_id || null

      });


    }

    catch (error) {

      console.error(
        "Status error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to check payment"

      });

    }

  }
);


// ==========================================
// SERVER
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `CEZOO Payment Server running on port ${PORT}`
    );

  }
);
