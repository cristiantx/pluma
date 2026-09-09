export function markdownFixture(bytes = 66_000): string {
  let markdown = "# Interaction regression document\n\n";
  for (let index = 0; index < 100; index += 1) {
    markdown += `## Section ${index + 1}\n\nParagraph ${index + 1} has an independent insertion target and readable text.\n\n| Key | Description |\n| --- | --- |\n| Cell${index + 1} | Wrapped cell ${index + 1} contains enough ordinary words to span several visual lines in a narrow table column and exercises pointer placement precisely. |\n\n`;
    if ([0, 1, 2, 15, 31, 47, 63, 99].includes(index)) {
      markdown += `\`\`\`mermaid\ngraph LR\n  A${index}[Start] --> B${index}[Finish]\n\`\`\`\n\nAfter diagram ${index + 1} remains editable and independently addressable.\n\n`;
    }
    markdown += `Section ${index + 1} concluding paragraph preserves source integrity across view changes, settings, themes, history operations, and pointer interaction.\n\n`;
  }
  const filler =
    "Additional prose keeps this deterministic document large while bounding diagram work and preserving editable Markdown paragraphs.\n\n";
  const footer = "\n\nFinal insertion target at the end of the document.\n";
  while (markdown.length + filler.length + footer.length <= bytes)
    markdown += filler;
  return (
    markdown +
    "x".repeat(Math.max(0, bytes - markdown.length - footer.length)) +
    footer
  );
}
