function smartSearchProducts(products, text) {
  const lowerText = String(text || "").toLowerCase().trim();

  // Budget
  const numbers = lowerText.match(/\d[\d,]*/g) || [];

  let budget = null;

  if (
    lowerText.includes("andar") ||
    lowerText.includes("under") ||
    lowerText.includes("tak") ||
    lowerText.includes("upto") ||
    lowerText.includes("within") ||
    lowerText.includes("budget")
  ) {
    if (numbers.length) {
      budget = Number(numbers[0].replace(/,/g, ""));
    }
  }

  // RAM
  const ramMatch = lowerText.match(
    /(\d+)\s*gb\s*ram|ram\s*(\d+)\s*gb|(\d+)\s*gb/
  );

  const requestedRam = ramMatch
    ? Number(ramMatch[1] || ramMatch[2] || ramMatch[3])
    : null;

  // Storage
  const storageMatch = lowerText.match(
    /(\d+)\s*gb\s*(?:storage|rom)|(?:storage|rom)\s*(\d+)\s*gb/
  );

  const requestedStorage = storageMatch
    ? Number(storageMatch[1] || storageMatch[2])
    : null;

  // Network
  const requestedNetwork =
    lowerText.includes("5g") ? "5G" :
    lowerText.includes("4g") ? "4G" :
    null;

  // Brands
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
    lowerText.includes(brand)
  );

  // Recommendation words
  const isBestQuery =
    lowerText.includes("best") ||
    lowerText.includes("sabse achha") ||
    lowerText.includes("accha phone") ||
    lowerText.includes("acha phone") ||
    lowerText.includes("top phone") ||
    lowerText.includes("recommend");

  const isCheapQuery =
    lowerText.includes("cheap") ||
    lowerText.includes("sasta") ||
    lowerText.includes("lowest price") ||
    lowerText.includes("sabse sasta");

  let matches = products.filter(product => {

    // Only available stock
    if (Number(product.stock) <= 0) {
      return false;
    }

    // Budget
    if (budget !== null && Number(product.price) > budget) {
      return false;
    }

    // RAM
    if (requestedRam !== null) {
      const productRam = Number(
        String(product.ram || "").match(/\d+/)?.[0]
      );

      if (productRam !== requestedRam) {
        return false;
      }
    }

    // Storage
    if (requestedStorage !== null) {
      const productStorage = Number(
        String(product.storage || "").match(/\d+/)?.[0]
      );

      if (productStorage !== requestedStorage) {
        return false;
      }
    }

    // Network
    if (requestedNetwork) {
      const productNetwork =
        String(product.network || "").toUpperCase();

      if (productNetwork !== requestedNetwork) {
        return false;
      }
    }

    // Brand
    if (requestedBrand) {
      const productName =
        String(product.name || "").toLowerCase();

      if (!productName.includes(requestedBrand)) {
        return false;
      }
    }

    return true;
  });

  // Best = highest price within requirement
  if (isBestQuery) {
    matches.sort((a, b) => Number(b.price) - Number(a.price));
  }

  // Cheap = lowest price first
  if (isCheapQuery) {
    matches.sort((a, b) => Number(a.price) - Number(b.price));
  }

  // Normal search = low price first
  if (!isBestQuery && !isCheapQuery) {
    matches.sort((a, b) => Number(a.price) - Number(b.price));
  }

  return {
    matches,
    budget,
    requestedRam,
    requestedStorage,
    requestedNetwork,
    requestedBrand,
    isBestQuery,
    isCheapQuery
  };
}

module.exports = smartSearchProducts;
