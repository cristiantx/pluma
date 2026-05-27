import type { EditorTab } from "./tabModel.js";
import { TabStrip } from "./TabStrip.js";

type EditorWorkspaceProps = {
  activeTabId: string;
  onActiveTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabsReorder: (tabs: EditorTab[]) => void;
  tabs: EditorTab[];
};

const sourcePreviewLines = [
  "# Welcome to Pluma",
  "",
  "Pluma is a fast and focused Markdown editor.",
  "Everything you need. Nothing you don't.",
  "",
  "---",
  "",
  "## Features",
  "",
  "- Rich editing experience",
  "- Live preview",
  "- Clean and minimal",
  "- Built for Markdown",
  "",
  "```js",
  "const hello = (name) => {",
  "  return `Hello, ${name}!`;",
  "};",
  "```",
  "",
  "## Quote",
  "",
  "> Simplicity is the ultimate sophistication.",
  ">",
  "> - Leonardo da Vinci"
];

export function EditorWorkspace({
  activeTabId,
  onActiveTabChange,
  onTabClose,
  onTabsReorder,
  tabs
}: EditorWorkspaceProps) {
  return (
    <section className="editor-workspace">
      <TabStrip
        activeTabId={activeTabId}
        onActiveTabChange={onActiveTabChange}
        onTabClose={onTabClose}
        onTabsReorder={onTabsReorder}
        tabs={tabs}
      />

      <div className="editor-panes">
        <article className="preview-pane" aria-label="Preview">
          <div className="preview-document">
            <h1>Welcome to Pluma</h1>
            <p>Pluma is a fast and focused Markdown editor.</p>
            <p>Everything you need. Nothing you don&apos;t.</p>
            <hr />
            <h2>Features</h2>
            <ul>
              <li>Rich editing experience</li>
              <li>Live preview</li>
              <li>Clean and minimal</li>
              <li>Built for Markdown</li>
            </ul>
            <pre>
              <code>{`const hello = (name) => {
  return \`Hello, \${name}!\`;
};`}</code>
            </pre>
            <h2>Quote</h2>
            <blockquote>
              <p>Simplicity is the ultimate sophistication.</p>
              <p>- Leonardo da Vinci</p>
            </blockquote>
          </div>
        </article>

        <article className="source-pane" aria-label="Markdown source">
          <ol className="source-lines">
            {sourcePreviewLines.map((line, index) => (
              <li key={`${index}-${line}`}>
                <code>{line || " "}</code>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
