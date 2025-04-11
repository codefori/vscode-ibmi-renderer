import { readFile, readFileSync } from "fs";
import { WebviewViewProvider, WebviewView, Uri, CancellationToken, WebviewViewResolveContext, Webview, DiagnosticSeverity, window, WebviewPanel, ViewColumn, ExtensionContext, workspace, TextDocument } from "vscode";
import { basename } from "path";
import { DisplayFile } from "./dspf";


export class RendererWebview {
  private view: WebviewPanel;
  private document: TextDocument|undefined;

  private get extensionPath() {
    return this.context.extensionUri;
  }

  constructor(private readonly context: ExtensionContext, private readonly workingUri: Uri) {
    const panel = window.createWebviewPanel(`ibmi_renderer`, `Renderer`, {
      preserveFocus: true,
      viewColumn: ViewColumn.Active
    });

    panel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        this.extensionPath,
        Uri.joinPath(this.extensionPath, 'webui'),
        Uri.joinPath(this.extensionPath, 'webui', `scripts`),
      ],
    };

    panel.webview.onDidReceiveMessage(this.onDidGetMessage.bind(this));

    panel.webview.html = this.getBaseHtml(panel.webview);

    this.view = panel;
  }

  async load() {
    this.document = await workspace.openTextDocument(this.workingUri);
    const content = this.document.getText();
  
    const dds = new DisplayFile();
    dds.parse(content.split(/\r?\n/));

    this.view.webview.postMessage({
      command: "load",
      dds: dds,
    });
  }

  show() {
    if (this.view) {
      this.view.reveal();
    }
  }

  private onDidGetMessage(message: any) {
  }

  private getBaseHtml(webview: Webview) {
    const basePath = toUri(webview, this.extensionPath, `webui`, `index.html`);
    // async might be better
    let content = readFileSync(basePath.fsPath, "utf-8");

    const fileVariables = {
      '{main}': toUri(webview, this.extensionPath, `webui`, `main.js`),
      '{elements}': toUri(webview, this.extensionPath, `webui`, `scripts`, `vscode-elements.js`),
      '{styles}': toUri(webview, this.extensionPath, `webui`, `styles.css`),
      '{codicon}': toUri(webview, this.extensionPath, `webui`, `scripts`, `codicon.css`),
      '{konva}': toUri(webview, this.extensionPath, `webui`, `scripts`, `konva.min.js`),
    };

    // Replace all variables in the content
    for (const [key, value] of Object.entries(fileVariables)) {
      const regex = new RegExp(key, 'g');
      content = content.replace(regex, value.toString());
    }

    return content;
  }

  static getCommandHref(command: string, ...args: unknown[]) {
    return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
  }  
}

function toUri(
  webview: Webview,
  extensionUri: Uri,
  ...pathList: string[]
) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}
