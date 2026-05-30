declare module "@milkdown/crepe" {
  import type { Editor } from "@milkdown/kit/core";
  import type { CrepeFeature } from "@milkdown/crepe";

  export type CrepeListenerApi = {
    markdownUpdated: (
      listener: (
        context: unknown,
        markdown: string,
        previousMarkdown: string
      ) => void
    ) => CrepeListenerApi;
  };

  export type CrepeConfig = {
    defaultValue?: string;
    features?: Partial<Record<CrepeFeature, boolean>>;
    root?: Node | string | null;
  };

  export class Crepe {
    static Feature: typeof CrepeFeature;
    constructor(config?: CrepeConfig);
    readonly editor: Editor;
    create(): Promise<unknown>;
    destroy(): Promise<unknown>;
    getMarkdown(): string;
    on(listener: (api: CrepeListenerApi) => void): this;
  }
}
