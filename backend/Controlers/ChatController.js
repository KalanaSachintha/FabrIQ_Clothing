const Product = require("../Model/ProductModel");

const APP_ASSET_ORIGIN =
  process.env.CHAT_ASSET_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  process.env.APP_ORIGIN ||
  "http://localhost:5000";

const COLORS = [
  "red",
  "black",
  "white",
  "blue",
  "green",
  "yellow",
  "pink",
  "purple",
  "grey",
  "gray",
  "brown",
  "beige",
];

const CATEGORY_SYNONYMS = {
  hoodie: ["hoodie", "hoodies", "hoody", "hoodys", "hooded", "hooded top"],
  "t-shirt": ["t-shirt", "tshirts", "t shirt", "tee", "tees"],
  shirt: ["shirt", "shirts", "buttondown", "button-down", "buttonup", "button-up"],
  denim: ["denim", "denims", "jeans", "jean"],
  dress: ["dress", "dresses", "gown", "frock"],
  skirt: ["skirt", "skirts"],
  sneakers: ["sneaker", "sneakers", "shoes", "shoe", "trainer", "trainers"],
  jacket: ["jacket", "jackets", "coat", "coats", "outerwear"],
};

const STOP_WORDS = new Set([
  "show",
  "find",
  "need",
  "looking",
  "for",
  "some",
  "something",
  "please",
  "give",
  "me",
  "with",
  "and",
  "or",
  "to",
  "of",
  "a",
  "an",
  "the",
  "that",
  "those",
  "these",
  "maybe",
  "want",
  "any",
  "budget",
  "under",
  "below",
  "less",
  "than",
  "max",
  "cheap",
  "cost",
  "price",
  "priced",
  "color",
  "colour",
  "size",
  "sizes",
  "style",
  "styles",
  "good",
  "nice",
  "cool",
  "new",
  "latest",
  ...COLORS,
]);

const SIZES = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl"];

const CATEGORY_ALIAS_LIST = Object.entries(CATEGORY_SYNONYMS).reduce(
  (list, [canonical, aliases]) => {
    aliases.forEach((alias) =>
      list.push({ canonical, alias: alias.replace(/\s+/g, "") })
    );
    return list;
  },
  []
);
const CATEGORY_ALIAS_SET = new Set(
  CATEGORY_ALIAS_LIST.map(({ alias }) => alias)
);

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(value = "", options = {}) {
  if (!value) return null;
  const pattern = options.anchored
    ? `^${escapeRegex(value)}$`
    : escapeRegex(value);
  return new RegExp(pattern, "i");
}

function levenshtein(a = "", b = "") {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function detectCategory(lower, tokens) {
  for (const [canonical, aliases] of Object.entries(CATEGORY_SYNONYMS)) {
    if (aliases.some((alias) => lower.includes(alias))) {
      return canonical;
    }
  }

  let best = { canonical: null, distance: Infinity };
  tokens.forEach((token) => {
    if (!token) return;
    const normalized = token.replace(/\s+/g, "");
    CATEGORY_ALIAS_LIST.forEach(({ canonical, alias }) => {
      const distance = levenshtein(normalized, alias);
      if (distance < best.distance) {
        best = { canonical, distance };
      }
    });
  });

  return best.distance <= 2 ? best.canonical : null;
}

function pickKeyword(tokens, color, category) {
  for (const token of tokens) {
    if (!token || STOP_WORDS.has(token)) continue;
    if (token === color || token === category) continue;
    const normalized = token.replace(/\s+/g, "");
    if (CATEGORY_ALIAS_SET.has(normalized)) continue;
    if (/^\d+$/.test(token)) continue;
    return token;
  }
  return null;
}

// Very lightweight keyword-based NLP fallback
function extractFiltersFromText(text) {
  const lower = String(text || "").toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);

  const priceMatch =
    lower.match(/(under|below|less than)\s*(\d+)/i) ||
    lower.match(/(max|up to)\s*(\d+)/i) ||
    lower.match(/(\d+)\s*(or less)/i);

  let maxPrice = null;
  if (priceMatch) {
    const val = Number(priceMatch[2] || priceMatch[1]);
    if (!Number.isNaN(val)) maxPrice = val;
  }

  const color = COLORS.find((c) => lower.includes(c));
  const category = detectCategory(lower, tokens);
  const size = SIZES.find((s) => tokens.includes(s));
  const keyword = pickKeyword(tokens, color, category);

  return { color, category, size, maxPrice, keyword };
}

async function findProductsFromFilters(filters) {
  const conditions = [];
  const base = {};

  if (filters.category) {
    base.category = buildRegex(filters.category, { anchored: true });
  }
  if (typeof filters.maxPrice === "number") {
    base.price = { $lte: filters.maxPrice };
  }
  if (Object.keys(base).length) {
    conditions.push(base);
  }

  if (filters.color) {
    const colorRegex = buildRegex(filters.color);
    conditions.push({
      $or: [
        { availableColors: { $in: [colorRegex] } },
        { "colorVariants.colorName": colorRegex },
      ],
    });
  }

  if (filters.keyword) {
    const keywordRegex = buildRegex(filters.keyword);
    conditions.push({
      $or: [
        { name: keywordRegex },
        { description: keywordRegex },
        { category: keywordRegex },
      ],
    });
  }

  const query =
    conditions.length === 0
      ? {}
      : conditions.length === 1
      ? conditions[0]
      : { $and: conditions };

  const products = await Product.find(query)
    .sort({ inStock: -1 })
    .limit(filters.category ? 6 : 10)
    .lean();

  return products;
}

function resolveImageUrl(product) {
  const candidates = [];
  if (product.imageUrl) candidates.push(product.imageUrl);
  if (Array.isArray(product.galleryImageUrls)) {
    candidates.push(...product.galleryImageUrls);
  }
  if (Array.isArray(product.colorVariants)) {
    product.colorVariants.forEach((variant) => {
      if (Array.isArray(variant?.imageUrls)) {
        candidates.push(...variant.imageUrls);
      }
    });
  }

  const selected = candidates.find((url) => typeof url === "string" && url.trim());
  if (!selected) return "";
  if (/^https?:\/\//i.test(selected)) return selected;
  const normalized = selected.startsWith("/") ? selected : `/${selected}`;
  return `${APP_ASSET_ORIGIN}${normalized}`;
}

function formatProductsForChat(products) {
  if (!products.length) {
    return {
      text: "I couldn’t find items matching that. Try changing the color, size, or price.",
      products: [],
    };
  }

  const productSummaries = products.map((p) => ({
    id: String(p._id),
    name: p.name,
    price: p.price,
    imageUrl: resolveImageUrl(p),
    brand: p.brand,
    category: p.category,
  }));

  const intro =
    products.length === 1
      ? "Here’s one option I found for you:"
      : `Here are ${products.length} options that might match what you’re looking for:`;

  return {
    text: intro,
    products: productSummaries,
  };
}

function basicSizeAdvice(text) {
  const lower = String(text || "").toLowerCase();
  const numbers = (lower.match(/\d+/g) || []).map(Number);

  let height = null;
  let weight = null;

  if (numbers.length >= 2) {
    height = numbers[0];
    weight = numbers[1];
  }

  // Very rough, generic guidance
  let size = "m";
  if (weight && weight < 55) size = "s";
  else if (weight && weight > 80) size = "l";
  if (weight && weight > 95) size = "xl";

  const advice =
    "Based on your details I’d generally suggest a " +
    size.toUpperCase() +
    " in most tops. For the best fit, please also check the size guide on each product page.";

  return advice;
}

// POST /api/chat/message
exports.handleChatMessage = async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Message text is required" });
    }

    const lower = message.toLowerCase();

    // If the user clearly asks about size advice
    if (/what size|which size|size should i|get size help/i.test(lower)) {
      const reply = basicSizeAdvice(message);
      return res.json({
        type: "size_help",
        message: reply,
        products: [],
      });
    }

    // Otherwise treat as product discovery / filtering
    const filters = extractFiltersFromText(message);
    const products = await findProductsFromFilters(filters);
    const { text, products: productSummaries } = formatProductsForChat(products);

    return res.json({
      type: "product_suggestions",
      message: text,
      products: productSummaries,
      filters,
    });
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ message: "Failed to process message" });
  }
};
