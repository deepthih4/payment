const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* =========================================
   MIDDLEWARE
========================================= */

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


/* =========================================
   CONFIG
========================================= */

const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const MERCHANT_UPI_ID =
  process.env.MERCHANT_UPI_ID;

const MERCHANT_NAME =
  process.env.MERCHANT_NAME || "CEZOO";


/* =========================================
   ENV CHECK
========================================= */

if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL missing");
}

if (!SUPABASE_SECRET_KEY) {
  console.error("❌ SUPABASE_SECRET_KEY missing");
}

if (!MERCHANT_UPI_ID) {
  console.error("❌ MERCHANT_UPI_ID missing");
}


/* =========================================
   SUPABASE
========================================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);


/* =========================================
   HOME PAGE
========================================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


/* =========================================
   HEALTH CHECK
========================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      success: true,
      message:
        "CEZOO Payment Server Running"
    });

  }
);


/* =========================================
   CREATE PAYMENT
========================================= */

app.post(
  "/api/payment/create",
  async (req, res) => {

    try {

      const amount =
        Number(req.body.amount);


      /* VALIDATE AMOUNT */

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Invalid payment amount"

          });

      }


      /* CHECK UPI ID */

      if (!MERCHANT_UPI_ID) {

        return res
          .status(500)
          .json({

            success: false,

            message:
              "Merchant UPI ID not configured"

          });

      }


      /* CREATE UNIQUE ORDER ID */

      const random =
        crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase();


      const orderId =
        `CEZOO_${Date.now()}_${random}`;


      /* SAVE TO SUPABASE */

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


        return res
          .status(500)
          .json({

            success: false,

            message:
              "Unable to create payment"

          });

      }


      /* CREATE UPI PAYMENT LINK */

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


      /* RESPONSE */

      return res.json({

        success: true,

        orderId: orderId,

        amount: amount,

        status: "PENDING",

        upiUrl: upiUrl

      });


    } catch (error) {

      console.error(
        "Create payment error:",
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          message:
            "Payment service unavailable"

        });

    }

  }
);


/* =========================================
   CUSTOMER - PAYMENT STATUS
========================================= */

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

        .maybeSingle();


      if (error) {

        console.error(
          "Payment status error:",
          error
        );


        return res
          .status(500)
          .json({

            success: false,

            message:
              "Unable to check payment"

          });

      }


      if (!data) {

        return res
          .status(404)
          .json({

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


    } catch (error) {

      console.error(
        "Status error:",
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          message:
            "Unable to check payment"

        });

    }

  }
);


/* =========================================
   ADMIN - GET ALL PAYMENTS
========================================= */

app.get(
  "/api/admin/payments",
  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase

        .from("upi_orders")

        .select(
          "id,order_id,amount,status,transaction_id"
        )

        .order(
          "id",
          {
            ascending: false
          }
        )

        .limit(100);


      if (error) {

        console.error(
          "Admin payments error:",
          error
        );


        return res
          .status(500)
          .json({

            success: false,

            message:
              "Unable to load payments"

          });

      }


      return res.json({

        success: true,

        payments:
          data || []

      });


    } catch (error) {

      console.error(
        "Admin payments error:",
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          message:
            "Server error"

        });

    }

  }
);


/* =========================================
   ADMIN - ACCEPT / REJECT
========================================= */

app.post(
  "/api/admin/payment/status",
  async (req, res) => {

    try {

      const orderId =
        String(
          req.body.orderId || ""
        ).trim();


      const status =
        String(
          req.body.status || ""
        )
          .trim()
          .toUpperCase();


      /* VALIDATE */

      if (!orderId) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Order ID required"

          });

      }


      const allowedStatuses = [
        "ACCEPTED",
        "REJECTED"
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Invalid payment status"

          });

      }


      /* CHECK ORDER */

      const {
        data: existingOrder,
        error: findError
      } = await supabase

        .from("upi_orders")

        .select(
          "order_id,status"
        )

        .eq(
          "order_id",
          orderId
        )

        .maybeSingle();


      if (findError) {

        console.error(
          "Find payment error:",
          findError
        );


        return res
          .status(500)
          .json({

            success: false,

            message:
              "Unable to find payment"

          });

      }


      if (!existingOrder) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              "Payment not found"

          });

      }


      /*
        Only PENDING payment
        can be accepted/rejected.
      */

      if (
        String(
          existingOrder.status
        ).toUpperCase()
        !== "PENDING"
      ) {

        return res
          .status(409)
          .json({

            success: false,

            message:
              "Payment already processed"

          });

      }


      /* UPDATE STATUS */

      const {
        data,
        error
      } = await supabase

        .from("upi_orders")

        .update({

          status: status

        })

        .eq(
          "order_id",
          orderId
        )

        .eq(
          "status",
          "PENDING"
        )

        .select(
          "id,order_id,amount,status,transaction_id"
        )

        .maybeSingle();


      if (error) {

        console.error(
          "Payment update error:",
          error
        );


        return res
          .status(500)
          .json({

            success: false,

            message:
              "Unable to update payment"

          });

      }


      if (!data) {

        return res
          .status(409)
          .json({

            success: false,

            message:
              "Payment already processed"

          });

      }


      console.log(
        `Payment ${orderId} → ${status}`
      );


      return res.json({

        success: true,

        message:
          status === "ACCEPTED"
            ? "Payment accepted"
            : "Payment rejected",

        payment: data

      });


    } catch (error) {

      console.error(
        "Admin update error:",
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          message:
            "Server error"

        });

    }

  }
);


/* =========================================
   404 API
========================================= */

app.use(
  "/api",
  (req, res) => {

    res
      .status(404)
      .json({

        success: false,

        message:
          "API route not found"

      });

  }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `CEZOO Payment Server running on port ${PORT}`
    );

  }
);
