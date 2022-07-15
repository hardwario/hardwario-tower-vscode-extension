/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';
import * as fs from 'fs';

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export default class ConsoleWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'harwdario.tower.views.console';

  private view?: vscode.WebviewView;

  extensionUri : vscode.Uri;

  constructor(private readonly extUri: vscode.Uri) {
    this.extensionUri = extUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ) {
    this.view = webviewView;

    this.view.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [
        this.extensionUri,
      ],
    };

    this.view.webview.html = this.getHtmlForWebview(webviewView.webview);

    this.view.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'saveLog':
        {
          const file = fs.createWriteStream(data.path);
          file.on('error', (err) => {
            vscode.window.showWarningMessage(err.toString());
          });
          data.message.forEach((v) => {
            file.write(`${v.value}\n`);
          });
          file.end();
          break;
        }
        default:
        {
          break;
        }
      }
    });
  }

  public addSerialData(data) {
    if (this.view) {
      this.view.webview.postMessage({ type: 'serialData', message: data });
    }
  }

  public clearData() {
    if (this.view) {
      this.view.webview.postMessage({ type: 'clearData' });
    }
  }

  public showWebView() {
    if (this.view) {
      this.view.show?.(false);
    } else {
      vscode.commands.executeCommand('workbench.view.extension.hardwarioTowerPanel');
    }
  }

  public saveLog(path) {
    this.view.webview.postMessage({ type: 'saveLog', path });
  }

  public turnOnAutoScroll() {
    this.view.webview.postMessage({ type: 'autoScroll' });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview,
    // then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'consoleWebView', 'main.js'));

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'consoleWebView', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'consoleWebView', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'consoleWebView', 'main.css'));

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">

                    <!--
                        Use a content security policy to only allow loading images from https or from our extension directory,
                        and only allow scripts that have a specific nonce.
                    -->
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

                    <meta name="viewport" content="width=device-width, initial-scale=1.0">

                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet">
                    <link href="${styleMainUri}" rel="stylesheet">
                </head>
                <body>
                    <ul class="data-list">
                    </ul>

                    <script nonce="${nonce}" src="${scriptUri}"></script>
                </body>
                </html>`;
  }
}
