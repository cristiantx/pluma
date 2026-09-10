export function sizePreviewDiagrams(root: ParentNode): void {
  for (const svg of root.querySelectorAll<SVGSVGElement>(
    ".cm-draftly-mermaid-rendered > svg"
  )) {
    const width = svg.viewBox.baseVal.width;
    if (Number.isFinite(width) && width > 0) {
      // Match the rich editor widget: keep natural size until the column is narrower.
      svg.style.width = `${width}px`;
    }
  }
}
