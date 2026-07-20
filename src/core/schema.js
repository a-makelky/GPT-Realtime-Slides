const LAYOUTS = new Set(["title", "statement", "bullets", "columns", "steps", "quote", "closing"]);

export function validateDeck(deck) {
  if (!deck || typeof deck !== "object") throw new Error("Deck must be an object.");
  if (deck.version !== 1) throw new Error("Deck version must be 1.");
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) throw new Error("Deck needs at least one slide.");

  const ids = new Set();
  for (const [index, slide] of deck.slides.entries()) {
    if (!slide || typeof slide !== "object") throw new Error(`Slide ${index + 1} must be an object.`);
    if (!isText(slide.id)) throw new Error(`Slide ${index + 1} needs a stable id.`);
    if (ids.has(slide.id)) throw new Error(`Duplicate slide id: ${slide.id}.`);
    ids.add(slide.id);
    if (!LAYOUTS.has(slide.layout)) throw new Error(`Unsupported layout on ${slide.id}: ${slide.layout}.`);
    if (!isText(slide.title)) throw new Error(`Slide ${slide.id} needs a title.`);
    if ("html" in slide) throw new Error(`Slide ${slide.id} cannot include arbitrary HTML.`);
    if (slide.layout === "bullets" && !textArray(slide.items)) throw new Error(`Slide ${slide.id} needs text items.`);
    if (["columns", "steps"].includes(slide.layout) && !cardArray(slide[slide.layout])) {
      throw new Error(`Slide ${slide.id} needs ${slide.layout}.`);
    }
  }
  return deck;
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function textArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}

function cardArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && isText(item.title) && isText(item.body));
}
