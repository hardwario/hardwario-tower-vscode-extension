/* eslint-disable max-len */
/* eslint-disable no-restricted-syntax */
// @ts-check

(function () {
  let ul = '';

  const vscode = acquireVsCodeApi();

  let autoScrool = true;

  document.getElementById('send-data-div').style.display = 'none';

  const oldState = vscode.getState() || {
    data: [], connectedDevice: '',
  };

  /** @type {Array<{ value: string }>} */
  let { data } = oldState || [];

  let { connectedDevice } = oldState || '';

  let commandHistory = [];

  let commandCounter = -1;
  let historyCounter = -1;

  if (connectedDevice === undefined) {
    connectedDevice = '';
  }

  if (commandHistory === undefined) {
    commandHistory = [];
  }

  updateDataList();

  document.getElementById('send-button').addEventListener('click', () => {
    sendData();
  });

  document.getElementById('send-data-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendData();
  });

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
        const logData = `${new Date().toLocaleTimeString([], { hour12: false })} ${event.data.message}`;
        data.push({ value: logData });
        updateDataList();
        break;
      }
      case 'connected':
      {
        connectedDevice = event.data.message;
        updateDataList();
        break;
      }
      case 'disconnected':
      {
        document.getElementById('send-data-div').style.display = 'none';
        connectedDevice = '';
        updateDataList();
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
      case 'autoScroll':
      {
        autoScrool = true;

        window.scrollTo(0, document.body.scrollHeight);
        break;
      }
      case 'showInputBox':
      {
        if (document.getElementById('send-data-div').style.display === 'block') {
          document.getElementById('send-data-div').style.display = 'none';
        } else {
          document.getElementById('send-data-div').style.display = 'block';
        }
        break;
      }
      default:
      {
        break;
      }
    }
  });

  function sendData() {
    const inputData = document.getElementById('send-data-input').value;

    if (commandHistory[commandHistory.length - 1] !== inputData) {
      commandHistory[commandCounter++] = inputData;
      historyCounter = commandCounter;
    } else {
      historyCounter = commandCounter;
    }

    vscode.postMessage({ type: 'sendData', message: inputData });

    const logData = `# SEND: ${inputData}`;
    data.push({ value: logData });
    updateDataList();

    document.getElementById('send-data-input').value = '';
    autoScroll = true;
  }

  function updateDataList() {
    const header = document.getElementById('header-div');
    if (header !== null) {
      if (connectedDevice === '') {
        header.textContent = 'NO DEVICE ATTACHED';
      } else {
        const delimiter = '-';
        const tokens = connectedDevice.split(delimiter).slice(0, 3);
        const result = tokens.join(delimiter); // this
        header.textContent = `CONSOLE ATTACHED TO: ${result}`;
      }
    }

    ul = document.querySelector('.data-list');
    ul.textContent = '';
    for (const record of data) {
      const li = document.createElement('li');
      li.className = 'color-entry';

      const logDiv = document.createElement('div');

      const logMessageSystemTimeContainer = document.createElement('span');
      const logMessageSystemTime = record.value.substring(0, record.value.indexOf('#'));
      const logMessageSystemTimeElement = document.createTextNode(logMessageSystemTime);

      logMessageSystemTimeContainer.className = 'log-message-time';

      const logMessageStartContainer = document.createElement('span');
      const logMessageStart = record.value.substring(record.value.indexOf('#'), record.value.indexOf('>') + 1);
      const logMessageStartElement = document.createTextNode(logMessageStart);

      const logMessage = record.value.substring(record.value.indexOf('>') + 1);
      const logMessageElement = document.createTextNode(logMessage);

      logMessageStartContainer.appendChild(logMessageStartElement);
      logMessageSystemTimeContainer.appendChild(logMessageSystemTimeElement);
      logDiv.appendChild(logMessageSystemTimeContainer);
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
    vscode.setState({ data, connectedDevice });
  }

  function clearLog() {
    data = [];
    vscode.setState({ data });
    updateDataList();
  }

  document.onkeydown = function (event) {
    const elem = document.getElementById('send-data-input');
    if (elem === document.activeElement) {
      switch (event.key) {
        case 'ArrowUp':
          if (historyCounter >= 0) {
            elem.value = commandHistory[--historyCounter];
          }
          break;
        case 'ArrowDown':
          if (historyCounter < commandHistory.length - 1) {
            elem.value = commandHistory[++historyCounter];
          }
          break;
        default:
          break;
      }
    }
  };
}());
