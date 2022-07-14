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

  constructor(
          private readonly extensionUri: vscode.Uri,
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
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
      // this.view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
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
    }
  }

  public saveLog(path) {
    this.view.webview.postMessage({ type: 'saveLog', path });
  }

  public turnOnAutoscrool() {
    this.view.webview.postMessage({ type: 'autoScrool' });
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
