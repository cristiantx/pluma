export type PreviewViewProps = {
  "aria-label"?: string;
  documentId: string;
  imageBaseUrl?: string | undefined;
  rawText: string;
  resolvedTheme: "dark" | "light";
  onOpenLinkRequest: (url: string) => void;
};
