const { chromium } = require("playwright");

const SOURCE_URL = process.env.SOURCE_URL || "https://gtaglitches.com/afk-accounts";

/*
 * The site renders its live list with JavaScript. This scraper opens the page,
 * selects the Xbox Series filter, and looks for account-like cards/rows.
 *
 * The public page's rendered markup can change. If the site changes its card
 * layout, inspect the diagnostic output and adjust CARD_SELECTOR / extraction.
 * The scraper intentionally fails closed (returns an error) rather than
 * inventing gamertags from random page text.
 */

const CARD_SELECTOR = [
  "article",
  "li",
  '[data-account]',
  '[class*="account" i]',
  '[class*="helper" i]',
  '[class*="card" i]',
  '[class*="listing" i]',
  '[class*="row" i]'
].join(",");

function cleanLines(text) {
  return text
    .split(/\n+/)
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeGamertag(value) {
  return value
    .replace(/^(gamertag|gamer tag|xbox tag|account)\s*[:\-]\s*/i, "")
    .replace(/^@/, "")
    .trim();
}

function looksLikeGamertag(line) {
  if (!line || line.length > 24 || line.length < 2) return false;
  if (/^(online|offline|working|banned|unusable|xbox series|xbox one|ps[45]|all platforms|change platform|add an account|view all|status|free aim|assisted aim)$/i.test(line)) return false;
  if (/^(online now|working|banned|offline|unusable)$/i.test(line)) return false;
  if (/https?:\/\//i.test(line) || line.includes("@")) return false;
  if (/^\d+$/.test(line)) return false;
  // Gamertags may contain letters, digits, spaces and a small set of punctuation.
  return /^[\p{L}\p{N}][\p{L}\p{N} _.'-]{0,23}$/u.test(line);
}

async function scrapeXboxSeries() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (compatible; AnawackXboxAlerts/1.0; +https://gtaglitches.com/)"
  });

  try {
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);

    const filter = page.getByRole("button", { name: /Xbox Series/i }).first();
    if (await filter.count()) {
      await filter.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2500);
    } else {
      throw new Error('Could not find the "Xbox Series" filter button on the source page.');
    }

    const result = await page.locator(CARD_SELECTOR).evaluateAll(elements => {
      const visible = elements.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return visible.map(el => ({
        text: (el.innerText || el.textContent || "").trim(),
        cls: String(el.className || ""),
        tag: el.tagName
      })).filter(x => x.text && x.text.length < 500);
    });

    const accounts = new Map();

    for (const card of result) {
      const lines = cleanLines(card.text);
      if (lines.length < 1) continue;

      const status = lines.find(line => /^(online(\s+now)?|offline|working|banned|unusable)$/i.test(line));
      // Ignore containers that are just headings/buttons or FAQ content.
      if (!status) continue;

      const candidates = lines
        .map(normalizeGamertag)
        .filter(looksLikeGamertag);

      if (!candidates.length) continue;

      // A card can contain nested card/row elements; use its first plausible
      // name. Map de-duplicates the same account found in nested containers.
      const gamertag = candidates[0];
      const key = gamertag.toLocaleLowerCase();
      if (!accounts.has(key)) {
        accounts.set(key, {
          gamertag,
          status: status.toLowerCase(),
          platform: "Xbox Series X|S",
          source: SOURCE_URL
        });
      }
    }

    if (accounts.size === 0) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const excerpt = bodyText.slice(0, 1800).replace(/\n{3,}/g, "\n\n");
      throw new Error(
        "The Xbox Series filter loaded, but no account cards could be parsed. " +
        "The website may have changed its markup or loaded no listings. " +
        "Page excerpt:\n" + excerpt
      );
    }

    return [...accounts.values()];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeXboxSeries };
