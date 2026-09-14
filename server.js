require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const multer = require("multer");
const smartSearchProducts = require("./smart-search");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${PORT}`;

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";

async function sendWhatsAppMessage(to, text) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WhatsApp credentials missing");
  }

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: text
      }
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("WhatsApp API error:", result);
    throw new Error("WhatsApp message failed");
  }

  return result;
}

async function sendWhatsAppImage(to, imageUrl, caption) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WhatsApp credentials missing");
  }

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: imageUrl,
        caption: caption
      }
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("WhatsApp image API error:", result);
    throw new Error("WhatsApp image message failed");
  }

  return result;
}

const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const dataDir = path.join(__dirname, "data");
const productsFile = path.join(dataDir, "products.json");
const leadsFile = path.join(dataDir, "leads.json");

const SHOP_ID = "shop_demo_001";
const SHOP_NAME = "My Mobile Shop";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(productsFile)) {
  fs.writeFileSync(productsFile, "[]");
}

function getProducts() {
  try {
    return JSON.parse(
      fs.readFileSync(productsFile, "utf8")
    );
  } catch {
    return [];
  }
}

function saveProducts(products) {
  fs.writeFileSync(
    productsFile,
    JSON.stringify(products, null, 2)
  );
}

function saveLead(lead) {
  let leads = [];

  try {
    if (fs.existsSync(leadsFile)) {
      leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
    }
  } catch {
    leads = [];
  }

  leads.push(lead);

  fs.writeFileSync(
    leadsFile,
    JSON.stringify(leads, null, 2)
  );
}

// Leads API

app.patch("/api/leads/:id", (req, res) => {
  try {
    let leads = [];

    if (fs.existsSync(leadsFile)) {
      leads = JSON.parse(
        fs.readFileSync(leadsFile, "utf8")
      );
    }

    const index = leads.findIndex(
      lead => String(lead.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    leads[index].status = req.body.status || "contacted";

    fs.writeFileSync(
      leadsFile,
      JSON.stringify(leads, null, 2)
    );

    res.json({
      success: true,
      lead: leads[index]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Lead update failed"
    });
  }
});

app.get("/api/leads", (req, res) => {
  try {
    let leads = [];

    if (fs.existsSync(leadsFile)) {
      leads = JSON.parse(
        fs.readFileSync(leadsFile, "utf8")
      );
    }

    res.json({
      success: true,
      leads
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Leads load failed"
    });
  }
});

// Server status
app.get("/api/status", (req, res) => {
  res.json({
    app: "DukaanAI",
    status: "running",
    message: "DukaanAI Backend is working 🚀"
  });
});

// Get products
app.get("/api/products", (req, res) => {
  res.json({
    success: true,
    products: getProducts()
  });
});

// Add product
app.post("/api/products", (req, res) => {
  const { name, price, ram, storage, network, stock, image } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({
      success: false,
      message: "Product name and price are required"
    });
  }

  const products = getProducts();

  const product = {
    id: Date.now().toString(),
    name: String(name),
    price: Number(price),
    ram: ram || "",
    storage: storage || "",
    network: network || "",
    stock: Number(stock) || 0,
    image: image || "",
    createdAt: new Date().toISOString()
  };

  products.push(product);
  saveProducts(products);

  res.status(201).json({
    success: true,
    message: "Product added successfully",
    product
  });
});

// Delete product
app.delete("/api/products/:id", (req, res) => {
  const products = getProducts();

  const newProducts = products.filter(
    product => product.id !== req.params.id
  );

  if (newProducts.length === products.length) {
    return res.status(404).json({
      success: false,
      message: "Product not found"
    });
  }

  saveProducts(newProducts);

  res.json({
    success: true,
    message: "Product deleted successfully"
  });
});

// Search products
app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "").toLowerCase();

  const results = getProducts().filter(product =>
    product.name.toLowerCase().includes(query) ||
    product.ram.toLowerCase().includes(query) ||
    product.storage.toLowerCase().includes(query)
  );

  res.json({
    success: true,
    query,
    results
  });
});

// Shop information

app.get("/api/shop", (req, res) => {
  res.json({
    success: true,
    shopId: SHOP_ID,
    shopName: SHOP_NAME
  });
});

// Generate Shop QR
app.get("/api/shop/qr", async (req, res) => {
  try {
    const shopUrl =
      `${BASE_URL}/customer/${SHOP_ID}`;

    const qr = await QRCode.toDataURL(shopUrl, { width: 800, margin: 4, errorCorrectionLevel: "H" });

    res.json({
      success: true,
      shopId: SHOP_ID,
      shopName: SHOP_NAME,
      url: shopUrl,
      qr: qr
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "QR generate nahi hua"
    });
  }
});

app.get("/customer/:shopId", (req, res) => {
  if (req.params.shopId !== SHOP_ID) {
    return res.status(404).send("Shop not found");
  }

  res.sendFile(
    path.join(__dirname, "public", "customer", "index.html")
  );
});


app.patch("/api/products/:id", (req, res) => {
  try {
    const products = getProducts();

    const index = products.findIndex(
      p => String(p.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const { price, ram, storage, network, stock } = req.body;

    if (price !== undefined) products[index].price = Number(price);
    if (ram !== undefined) products[index].ram = String(ram);
    if (storage !== undefined) products[index].storage = String(storage);
    if (network !== undefined) products[index].network = String(network);
    if (stock !== undefined) products[index].stock = Number(stock);

    fs.writeFileSync(
      productsFile,
      JSON.stringify(products, null, 2)
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      product: products[index]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Product update failed"
    });
  }
});

app.post("/api/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image required"
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      message: "Image uploaded successfully",
      image: imageUrl
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Image upload failed"
    });
  }
});


// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 DukaanAI running at http://0.0.0.0:${PORT}`
  );
});

app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "dukaanai_verify_2026") {
    console.log("✅ WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
})

app.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Meta may send status/other events without a message.
    if (!message) {
      return res.sendStatus(200);
    }

    const phoneNumberId = value?.metadata?.phone_number_id;
    const customerWhatsApp = String(message.from || "").replace(/\D/g, "");

    if (phoneNumberId !== WHATSAPP_PHONE_NUMBER_ID) {
      return res.sendStatus(200);
    }

    const text = String(message.text?.body || "").trim();
    const lowerText = text.toLowerCase();
    const products = getProducts();

    let reply = "";
    let matches = [];

    // Hi / Hello
    if (
      lowerText === "hi" ||
      lowerText === "hello" ||
      lowerText === "namaste"
    ) {
      reply =
        `Namaste! 👋 ${SHOP_NAME} mein aapka swagat hai.\n\n` +
        `📱 Mobile dekhne ke liye "mobile" likhein.\n` +
        `💰 Budget batayein, jaise "15000 ke andar".`;
    }

    // Smart search
    else {
      const textLower = lowerText;

      // Budget
      // Budget is detected only when the message contains
      // "andar", "under", or "budget".
      const numbers = textLower.match(/\d[\d,]*/g) || [];
      const isBudgetQuery =
        textLower.includes("andar") ||
        textLower.includes("under") ||
        textLower.includes("budget");

      const budget = isBudgetQuery && numbers.length
        ? Number(numbers[0].replace(/,/g, ""))
        : null;

      // RAM
      const ramMatch = textLower.match(
        /(\d+)\s*gb\s*ram|ram\s*(\d+)\s*gb/
      );
      const requestedRam = ramMatch
        ? Number(ramMatch[1] || ramMatch[2])
        : null;

      // Storage
      const storageMatch = textLower.match(
        /(\d+)\s*gb\s*(?:storage|rom)|(?:storage|rom)\s*(\d+)\s*gb/
      );
      const requestedStorage = storageMatch
        ? Number(storageMatch[1] || storageMatch[2])
        : null;

      // Network
      const requestedNetwork =
        textLower.includes("5g") ? "5G" :
        textLower.includes("4g") ? "4G" :
        null;

      // Brand
      const brands = [
        "samsung",
        "vivo",
        "oppo",
        "realme",
        "xiaomi",
        "redmi",
        "oneplus",
        "iphone",
        "apple",
        "motorola",
        "poco",
        "iqoo",
        "nothing"
      ];

      const requestedBrand = brands.find(brand =>
        textLower.includes(brand)
      );

      // Model/name words
      const searchWords = textLower
        .replace(/\d[\d,]*/g, " ")
        .replace(/\b(gb|ram|storage|rom|mobile|phone|wala|wla|ke|andar|under|budget|mein|me|chahiye|dikhao|dikha|do|hai|ka|ki|with|mujhe|available)\b/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      matches = products.filter(p => {

        // Stock filter
        if (Number(p.stock) <= 0) return false;

        // Budget filter
        if (budget !== null && Number(p.price) > budget) {
          return false;
        }

        // RAM filter
        if (requestedRam !== null) {
          const productRam = Number(
            String(p.ram || "").match(/\d+/)?.[0]
          );

          if (productRam !== requestedRam) return false;
        }

        // Storage filter
        if (requestedStorage !== null) {
          const productStorage = Number(
            String(p.storage || "").match(/\d+/)?.[0]
          );

          if (productStorage !== requestedStorage) return false;
        }

        // Network filter
        if (requestedNetwork) {
          const productNetwork =
            String(p.network || "").toUpperCase();

          if (productNetwork !== requestedNetwork) {
            return false;
          }
        }

        // Brand filter
        if (requestedBrand) {
          const productName = String(p.name || "").toLowerCase();

          if (!productName.includes(requestedBrand)) {
            return false;
          }
        }

        // Specific model search
        if (!requestedBrand && searchWords.length) {
          const productName = String(p.name || "").toLowerCase();

          const matched = searchWords.some(word =>
            productName.includes(word)
          );

          if (!matched) return false;
        }

        return true;
      });

      if (!matches.length) {
        reply =
          `😔 Aapki requirement ke according koi mobile available nahi hai.\n\n` +
          `Example:\n` +
          `• Samsung mobile\n` +
          `• Vivo mobile\n` +
          `• 8GB RAM wala mobile\n` +
          `• 128GB storage\n` +
          `• Vivo 15000 ke andar`;
      } else {

        saveLead({
          id: Date.now().toString(),
          shopId: SHOP_ID,
          customer: customerWhatsApp || "unknown",
          message: text,
          products: matches.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
          })),
          createdAt: new Date().toISOString(),
          status: "new"
        });

        reply =
          `📱 Aapki requirement ke according available mobiles:\n\n` +
          matches.map((p, i) =>
            `${i + 1}. ${p.name}\n` +
            `💰 Price: ₹${Number(p.price).toLocaleString("en-IN")}\n` +
            `RAM: ${p.ram || "N/A"} | Storage: ${p.storage || "N/A"}\n` +
            `🟢 Stock: ${p.stock}`
          ).join("\n\n");
      }
    }

    // Send automatic WhatsApp reply
await sendWhatsAppMessage(customerWhatsApp, reply);

// Send product images when available
if (matches && matches.length) {
  for (const p of matches) {
    if (!p.image) continue;

    const imageUrl = p.image.startsWith("http")
      ? p.image
      : `${BASE_URL}${p.image}`;

    const caption =
      `📱 ${p.name}\n` +
      `💰 Price: ₹${Number(p.price).toLocaleString("en-IN")}\n` +
      `RAM: ${p.ram || "N/A"} | Storage: ${p.storage || "N/A"}\n` +
      `📶 Network: ${p.network || "N/A"}\n` +
      `🟢 Stock: ${p.stock || 0}`;

    try {
      await sendWhatsAppImage(
        customerWhatsApp,
        imageUrl,
        caption
      );
    } catch (imageError) {
      console.error(
        "Product image send failed:",
        imageError
      );
    }
  }
}





    res.sendStatus(200);

  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    res.sendStatus(200);
  }
});
