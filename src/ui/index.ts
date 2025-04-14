import { readFile, readFileSync } from "fs";
import { WebviewViewProvider, WebviewView, Uri, CancellationToken, WebviewViewResolveContext, Webview, DiagnosticSeverity, window, WebviewPanel, ViewColumn, ExtensionContext, workspace, TextDocument, TextEdit, Range, WorkspaceEdit, Position } from "vscode";
import { basename } from "path";
import { DisplayFile, FieldInfo } from "./dspf";


export class RendererWebview {
  private view: WebviewPanel;
  private document: TextDocument|undefined;
  private dds: DisplayFile|undefined;

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

    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.load();
      }
    });
    panel.webview.onDidReceiveMessage(this.onDidGetMessage.bind(this));

    panel.webview.html = this.getBaseHtml(panel.webview);

    this.view = panel;
  }

  async load(rerender = true) {
    this.document = await workspace.openTextDocument(this.workingUri);
    const content = this.document.getText();
  
    this.dds = new DisplayFile();
    this.dds.parse(content.split(/\r?\n/));

    this.view.webview.postMessage({
      command: rerender ? "load" : "update",
      dds: this.dds,
    });
  }

  show() {
    if (this.view) {
      this.view.reveal();
    }
  }

  private async onDidGetMessage(message: any) {
    let recordFormat: string|undefined;
    let fieldInfo: FieldInfo|undefined;

    switch (message.command) {
      case 'newField':
        recordFormat = message.recordFormat;
        fieldInfo = message.fieldInfo;

        if (typeof recordFormat === `string` && typeof fieldInfo === `object`) {
          const newField = this.dds?.updateField(recordFormat, undefined, fieldInfo);

          if (newField) {
            if (newField.range && this.document) {
              const workspaceEdit = new WorkspaceEdit();
              workspaceEdit.insert(
                this.document.uri, 
                new Position(newField.range.start, 0),
                newField.newLines.join('\n') + `\n`, // TOOD: use the correct EOL?
                {label: `Add DDS Field`, needsConfirmation: false} 
              );

              if (await workspace.applyEdit(workspaceEdit)) {
                this.load(true);
              }
            }
          }
        }

        break;
      case `updateField`:
        recordFormat = message.recordFormat;
        const originalFieldName = message.originalFieldName;
        fieldInfo = message.fieldInfo;

        if (typeof recordFormat === `string` && typeof originalFieldName === `string` && typeof fieldInfo === `object`) {
          const fieldUpdate = this.dds?.updateField(recordFormat, originalFieldName, fieldInfo);

          if (fieldUpdate) {
            if (fieldUpdate.range && this.document) {
              const workspaceEdit = new WorkspaceEdit();
              workspaceEdit.replace(
                this.document.uri, 
                new Range(fieldUpdate.range.start, 0, fieldUpdate.range.end, 1000), 
                fieldUpdate.newLines.join('\n'), // TOOD: use the correct EOL?
                {label: `Update DDS Field`, needsConfirmation: false} 
              );

              await workspace.applyEdit(workspaceEdit);
              this.load(false);
            }
          }
        }
        break;
    }
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
