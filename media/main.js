// @ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  let ul = '';

  const vscode = acquireVsCodeApi();

  const oldState = vscode.getState() || { data: [] };

  /** @type {Array<{ value: string }>} */
  let { data } = oldState;

  data = [];
  updateDataList(data);

  /* document.querySelector('.clear-log-button').addEventListener('click', () => {
    clearLog();
  }); */

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
        data = [];
        updateDataList(data);
        break;
      }
      case 'saveLog':
      {
        vscode.postMessage({ type: 'saveLog' });
        break;
      }
      default:
      {
        break;
      }
    }
  });

  /**
   * @param {Array<{ value: string }>} data
   */
  function updateDataList(data) {
    ul = document.querySelector('.data-list');
    ul.textContent = '';
    for (const record of data) {
      const li = document.createElement('li');
      li.className = 'color-entry';

      /* const colorPreview = document.createElement('div');
      colorPreview.className = 'color-preview';
      colorPreview.style.backgroundColor = `#${color.value}`;
      colorPreview.addEventListener('click', () => {
        onColorClicked(color.value);
      });
      li.appendChild(colorPreview); */

      const logDiv = document.createElement('div');
      const logMessage = document.createTextNode(record.value);
      logDiv.appendChild(logMessage);

      if (record.value.includes('<D>')) {
        logDiv.className = 'debug-log';
      } else if (record.value.includes('<I>')) {
        logDiv.className = 'debug-info';
      } else if (record.value.includes('<W>')) {
        logDiv.className = 'debug-warning';
      } else if (record.value.includes('<E>')) {
        logDiv.className = 'debug-error';
      }
      // input.className = 'color-input';
      // input.type = 'text';
      // input.value = record.value;
      /* input.addEventListener('change', (e) => {
        const { value } = e.target;
        if (!value) {
          // Treat empty value as delete
          data.splice(data.indexOf(record), 1);
        } else {
          record.value = value;
        }
        updateDataList(data);
      }); */
      li.appendChild(logDiv);

      ul.appendChild(li);
    }

    // Update the saved state
    vscode.setState({ data });
  }

  /**
   * @param {string} color
   */
  function onColorClicked(color) {
    vscode.postMessage({ type: 'colorSelected', value: color });
  }

  function clearLog() {
    data = [];
    updateDataList(data);
  }
}());
