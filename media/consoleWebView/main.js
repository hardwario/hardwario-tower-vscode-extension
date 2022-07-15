/* eslint-disable max-len */
/* eslint-disable no-restricted-syntax */
// @ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  let ul = '';

  const vscode = acquireVsCodeApi();

  let autoScrool = true;

  const oldState = vscode.getState() || { data: [] };

  /** @type {Array<{ value: string }>} */
  let data = oldState;

  data = [];
  updateDataList(data);

  addEventListener('wheel', (event) => {
    if (autoScrool) {
      autoScrool = false;
    } else if (!autoScrool && ((window.innerHeight + window.scrollY) >= document.body.offsetHeight)) {
      autoScrool = true;
    }
  });

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case 'serialData':
      {
        data.push({ value: event.data.message });
        updateDataList(data);
        vscode.postMessage({ type: 'serialData', message: event.data.message });
        break;
      }
      case 'clearData':
      {
        clearLog();
        break;
      }
      case 'saveLog':
      {
        vscode.postMessage({ type: 'saveLog', message: data, path: event.data.path });
        break;
      }
      case 'autoScrool':
      {
        autoScrool = true;
        window.scrollTo(0, document.body.scrollHeight);
        break;
      }
      default:
      {
        break;
      }
    }
  });

  function updateDataList() {
    ul = document.querySelector('.data-list');
    ul.textContent = '';
    for (const record of data) {
      const li = document.createElement('li');
      li.className = 'color-entry';

      const logDiv = document.createElement('div');

      const logMessageStartContainer = document.createElement('span');
      const logMessageStart = record.value.substring(0, record.value.indexOf('>') + 1);
      const logMessageStartElement = document.createTextNode(logMessageStart);

      const logMessage = record.value.substring(record.value.indexOf('>') + 1);
      const logMessageElement = document.createTextNode(logMessage);

      logMessageStartContainer.appendChild(logMessageStartElement);
      logDiv.appendChild(logMessageStartContainer);
      logDiv.appendChild(logMessageElement);

      if (logMessageStart.includes('<D>')) {
        logMessageStartContainer.className = 'debug-log';
      } else if (logMessageStart.includes('<I>')) {
        logMessageStartContainer.className = 'debug-info';
      } else if (logMessageStart.includes('<W>')) {
        logMessageStartContainer.className = 'debug-warning';
      } else if (logMessageStart.includes('<E>')) {
        logMessageStartContainer.className = 'debug-error';
      }
      li.appendChild(logDiv);

      ul.appendChild(li);
    }
    if (autoScrool) {
      window.scrollTo(0, document.body.scrollHeight);
    }

    // Update the saved state
    vscode.setState({ data });
  }

  function clearLog() {
    data = [];
    updateDataList(data);
  }
}());
