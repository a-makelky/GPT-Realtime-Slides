function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

export function renderSlide(slide, position, total) {
  const article = element("article", `slide slide--${slide.layout}`);
  article.dataset.slideId = slide.id;
  const pad = element("div", "slide__pad");
  const header = element("header", "slide__header");
  header.append(element("span", "slide__number", String(position).padStart(2, "0")));
  header.append(element("span", "slide__eyebrow", slide.eyebrow || ""));
  pad.append(header);

  const content = element("div", "slide__content");
  content.append(element("h1", "slide__title", slide.title));
  if (slide.body) content.append(element("p", "slide__body", slide.body));

  if (slide.layout === "bullets") {
    const list = element("ul", "bullet-list");
    slide.items.forEach((item) => list.append(element("li", "bullet-list__item", item)));
    content.append(list);
  }

  if (slide.layout === "columns") content.append(renderCards(slide.columns, "column-grid"));
  if (slide.layout === "steps") content.append(renderCards(slide.steps, "step-grid"));
  pad.append(content);

  const footer = element("footer", "slide__footer");
  footer.append(element("span", "", slide.footer || slide.eyebrow || ""));
  footer.append(element("span", "", `${String(position).padStart(2, "0")} / ${total}`));
  pad.append(footer);
  article.append(pad);
  return article;
}

function renderCards(cards, className) {
  const grid = element("div", className);
  cards.forEach((card) => {
    const item = element("section", `${className}__item`);
    if (card.label) item.append(element("span", `${className}__label`, card.label));
    item.append(element("h2", `${className}__title`, card.title));
    item.append(element("p", `${className}__body`, card.body));
    grid.append(item);
  });
  return grid;
}
