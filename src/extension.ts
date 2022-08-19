/* eslint-disable class-methods-use-this */
/* eslint-disable no-use-before-define */
/* eslint-disable max-len */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SerialPort } from 'serialport';
import { spawn } from 'child_process';
import getEnv from './output';
import Terminal from './terminal';
import * as helpers from './helpers';
import PaletteProvider from './palette';
import { flash } from './flasher/flasherSerial';
import SerialPortConsole from './console/serialReader';
import ConsoleWebViewProvider from './console/consoleWebView';

/**
 * Instances of clone terminal used for git commands
 */
const cloneTerminal = new Terminal('HARDWARIO TOWER Clone');

/* Last selected folder used on cloning */
let lastSelectedFolder = '';

/* Build type of the firmware */
let buildType = 'Debug';
let releaseBar: vscode.StatusBarItem;

/* VSCode extension context */
let contextGlobal: vscode.ExtensionContext;

/* Console Web View provider */
let webViewProvider;

/* Instance of a serial port console */
let serialConsole;

/* List of serial ports available for flashing */
let serialPorts;

/* Currently selected serial port (item on the bottom bar) */
let portSelection : vscode.StatusBarItem = null;

/* Actual name of currently selected serial port */
let selectedPort = '';
let selectedPortNumber = '';

/* Index of currently selected device on serial port */
let deviceIndex = 0;

let preDebugBuildActive = false;

/* Flags to chain commands for Build -> Flash -> Attach console */
let flashAfterBuild = false;
let logAfterFlash = false;

let attachingConsole = false;
let disconnectingConsole = false;

/* Lock to disable flashing while there is another flashing running */
let flashing = false;

let warningPresent = false;

let hardwarioOutputChannel : vscode.OutputChannel;

/**
 * Builds the project before the start of the debug session with Jlink
 */
function preDebugBuild() {
  helpers.checkDirtyFiles();

  if (buildType.toLowerCase() !== 'debug') {
    vscode.commands.executeCommand('hardwario.tower.changeBuildType');
  }

  vscode.commands.executeCommand('hardwario.tower.build');
}

/**
 * Sends a message to add received serial data from console to the web view
 */
function addSerialData(data) {
  webViewProvider.addSerialData(data);
}

/**
 * Create, define and push the basic commands to the palette
 */
function pushGeneralCommands() {
  /**
   * Clone skeleton firmware from github and open it as a folder
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.cloneSkeleton', async () => {
    if ((helpers.isPortable() && helpers.LINUX) || (!helpers.isPortable())) {
      helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    }

    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      title: 'Select parent folder for new firmware',
      openLabel: 'Select folder',
    };
    vscode.window.showOpenDialog(options).then((folderUri) => {
      if (folderUri) {
        let folderUriString = '';
        if (helpers.WINDOWS) {
          folderUriString = `${folderUri[0].path.substring(1)}/`;
        } else if (helpers.LINUX || helpers.MACOS) {
          folderUriString = `${folderUri[0].path}/`;
        }

        const inputOptions = {
          value: 'twr-skeleton',
          title: 'Skeleton firmware folder name',
        };

        vscode.window.showInputBox(inputOptions).then((text) => {
          if (text === undefined || text === '') {
            folderUriString += 'twr-skeleton';
          } else {
            folderUriString += text;
          }
          cloneTerminal.get().sendText(`git clone --recursive https://github.com/hardwario/twr-skeleton.git "${folderUriString}" && exit`);
          cloneTerminal.get().show();
          helpers.checkDirtyFiles();

          lastSelectedFolder = folderUriString;
        });
      }
    });
  }));

  /**
   * Clone selected firmware from the github and open it as a folder
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.cloneFirmware', async () => {
    if ((helpers.isPortable() && helpers.LINUX) || (!helpers.isPortable())) {
      helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    }

    helpers.updateFirmwareJson()
      .then((data : string) => {
        const firmwareList = [];
        const json = JSON.parse(data);

        json.forEach((firmware) => {
          firmwareList.push({ label: firmware.name.split('/')[1], description: firmware.description, link: `${firmware.repository}.git` });
        });

        const quickPickOptions: vscode.QuickPickOptions = {
          placeHolder: 'Pick firmware template',
          canPickMany: false,
          title: 'Firmware template',
          matchOnDescription: true,
          matchOnDetail: true,
        };

        vscode.window.showQuickPick(
          firmwareList,
          quickPickOptions,
        ).then((pickedItem) => {
          if (pickedItem) {
            const options: vscode.OpenDialogOptions = {
              canSelectMany: false,
              canSelectFiles: false,
              canSelectFolders: true,
              title: 'Select parent folder for new firmware',
              openLabel: 'Select folder',
            };

            vscode.window.showOpenDialog(options).then((folderUri) => {
              if (folderUri) {
                let folderUriString = '';
                if (helpers.WINDOWS) {
                  folderUriString = `${folderUri[0].path.substring(1)}/`;
                } else if (helpers.LINUX || helpers.MACOS) {
                  folderUriString = `${folderUri[0].path}/`;
                }

                const inputOptions = {
                  value: pickedItem.label,
                  title: 'Skeleton firmware folder name',
                };

                vscode.window.showInputBox(inputOptions).then((text) => {
                  if (text === undefined || text === '') {
                    folderUriString += pickedItem.label;
                  } else {
                    folderUriString += text;
                  }
                  cloneTerminal.get().sendText(`git clone --recursive ${pickedItem.link} "${folderUriString}" && exit`);
                  cloneTerminal.get().show();
                  helpers.checkDirtyFiles();

                  lastSelectedFolder = folderUriString;
                });
              }
            });
          }
        });
      })
      .catch(() => {});
  }));

  /**
   * Open documentation website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openDocumentation', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/'));
  }));

  /**
   * Open SDK website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openSdk', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://sdk.hardwario.com/index.html'));
  }));

  /**
   * Open shop website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openShop', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://shop.hardwario.com'));
  }));

  /**
   * Open hackster.io projects website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openProjects', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://www.hackster.io/hardwario/projects'));
  }));

  /**
   * Open HARDWARIO github page
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openGithub', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/hardwario'));
  }));

  /**
   * Open HARDWARIO Forum
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openForum', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://forum.hardwario.com'));
  }));

  /**
   * Open HARDWARIO main website
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.openWebsite', () => {
    vscode.env.openExternal(vscode.Uri.parse('https://www.hardwario.com/cs/kit/'));
  }));
}

function runNinja(resolve, reject, envClone) {
  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  const ninjaProcess = spawn(
    'ninja',
    ['-C', `obj/${buildType.toLowerCase()}`],
    {
      cwd: workspaceFolder.uri.fsPath.toString(),
      env: envClone,
    },
  );

  ninjaProcess.stdout.on('data', (data) => {
    if ((data.toString()).includes('warning')) {
      warningPresent = true;
    }
    hardwarioOutputChannel.append(`${data}`);
  });

  ninjaProcess.stderr.on('data', (data) => {
    hardwarioOutputChannel.append(`${data}`);
  });

  ninjaProcess.on('error', () => {
    hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
    hardwarioOutputChannel.appendLine('There was an error executing ninja command. Please check your PATH and that you have ninja installed');
    hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
    reject();
  });

  ninjaProcess.on('exit', (code) => {
    if (code === 0) {
      if (preDebugBuildActive) {
        preDebugBuildActive = false;
        helpers.startDebug();
      } else if (flashAfterBuild) {
        flashAfterBuild = false;
        helpers.sleep(1500);
        vscode.commands.executeCommand('hardwario.tower.flash');
      }
      resolve();
    } else {
      reject();
    }
  });
}

/**
 * Create, define and push the advanced commands to the palette
 * when HARDWARIO TOWER firmware is opened
 */
function pushHardwarioCommands() {
  /**
   * Build code with make and create final binary
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.build', () => {
    helpers.checkDirtyFiles();
    warningPresent = false;

    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    const envClone = getEnv();

    hardwarioOutputChannel.clear();

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Build Firmware: Running...',
      cancellable: false,
    }, () => new Promise<void>((resolve, reject) => {
      if (!(helpers.isCmakeGenerated(buildType.toLowerCase()))) {
        const cmakeProcess = spawn(
          'cmake',
          [`-Bobj/${buildType.toLowerCase()}`, '.', '-G Ninja', '-DCMAKE_TOOLCHAIN_FILE=sdk/toolchain/toolchain.cmake', `-DTYPE=${buildType.toLowerCase()}`],
          {
            cwd: workspaceFolder.uri.fsPath.toString(),
            env: envClone,
          },
        );

        cmakeProcess.stdout.on('data', (data) => {
          hardwarioOutputChannel.append(data.toString());
        });

        cmakeProcess.stderr.on('data', (data) => {
          hardwarioOutputChannel.append(data.toString());
        });

        cmakeProcess.on('error', () => {
          hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
          hardwarioOutputChannel.appendLine('There was an error executing cmake command. Please check your PATH and that you have cmake installed');
          hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
          reject();
        });

        cmakeProcess.on('exit', (code) => {
          if (code === 0) {
            runNinja(resolve, reject, envClone);
          } else {
            reject();
          }
        });
      } else {
        runNinja(resolve, reject, envClone);
      }
    }).then(() => {
      let output = '';
      if (warningPresent) {
        hardwarioOutputChannel.show(false);

        output = 'Build Firmware: Success (with Warnings)';
        vscode.window.showWarningMessage(
          output,
        ).then((answer) => {
          if (answer === 'Show the output') {
            hardwarioOutputChannel.show(false);
          }
        });

        hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
        hardwarioOutputChannel.appendLine('                                TOWER: Build finished with warnings                                 ');
        hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
      } else {
        output = 'Build Firmware: Success';
        vscode.window.showInformationMessage(
          output,
          'Show the output',
        ).then((answer) => {
          if (answer === 'Show the output') {
            hardwarioOutputChannel.show(false);
          }
        });
        hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
        hardwarioOutputChannel.appendLine('                                TOWER: Build finished successfully                                  ');
        hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
      }
    }).catch(() => {
      hardwarioOutputChannel.show(false);

      flashAfterBuild = false;
      logAfterFlash = false;
      vscode.window.showErrorMessage(
        'Build Firmware: Failure',
      )
        .then((answer) => {
          if (answer === 'Show the output') {
            hardwarioOutputChannel.show(false);
          }
        });
      hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
      hardwarioOutputChannel.appendLine('                      TOWER: Build finished with errors (NO FIRMWARE GENERATED)                     ');
      hardwarioOutputChannel.appendLine('----------------------------------------------------------------------------------------------------');
    }));
  }));

  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flash', async () => {
    helpers.checkDirtyFiles();

    if (flashing) {
      vscode.window.showWarningMessage('Wait for the previous flashing to finish');
      return;
    }

    if (serialConsole !== undefined) {
      vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
    }

    if (selectedPort === '') {
      vscode.window.showWarningMessage('No HARDWARIO TOWER module connected. Please connect it and try again.');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const firmwarePath = path.join(workspaceFolder.uri.fsPath.toString(), 'firmware.bin');

    let lastPercent = 0;

    flashing = true;

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'HARDWARIO TOWER Flash',
      cancellable: false,
    }, (progress) => flash(selectedPort, firmwarePath, (type, flashProgress, progressMax) => {
      const percent = Math.round((flashProgress / progressMax) * 100);

      if (type === 'erase') {
        progress.report({ increment: percent - lastPercent, message: 'Erasing' });
      }
      if (type === 'write') {
        progress.report({ increment: percent - lastPercent, message: 'Writing' });
      }
      if (type === 'verify') {
        progress.report({ increment: percent - lastPercent, message: 'Verifying' });
      }
      lastPercent = percent;
    })
      .then(() => {
        flashing = false;
        vscode.window.showInformationMessage('Flash Firmware: Success');
        if (logAfterFlash) {
          vscode.commands.executeCommand('hardwario.tower.console');
          logAfterFlash = false;
        }
      })
      .catch((e) => {
        flashing = false;
        vscode.window.showWarningMessage('Flash Firmware: Failure');
        vscode.window.showWarningMessage(
          e.toString(),
        );
      }));
  }));

  /**
   * Upload the firmware to the selected connected device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashToDevice', async () => {
    helpers.checkDirtyFiles();

    flashAfterBuild = true;
    vscode.commands.executeCommand('hardwario.tower.build');
  }));

  /**
   * Change selected device where the firmware should be uploaded to
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.changeDevice', async () => {
    if (serialPorts.length === 0) {
      return;
    }

    deviceIndex += 1;
    if (deviceIndex >= serialPorts.length) {
      deviceIndex = 0;
    }

    if (portSelection !== null) {
      portSelection.dispose();
      portSelection = null;
    }
    if (portSelection === null) {
      selectedPort = serialPorts[deviceIndex].path;
      selectedPortNumber = serialPorts[deviceIndex].serialNumber;
      portSelection = vscode.window.createStatusBarItem(
        'toolbar',
        vscode.StatusBarAlignment.Left,
        1,
      );

      portSelection.name = 'HARDWARIO: Toolbar';

      portSelection.text = `Device: ${serialPorts[deviceIndex].path} - ${serialPorts[deviceIndex].serialNumber.split('-').slice(0, 3).join('-')}`;

      portSelection.tooltip = 'HARDWARIO: Change device';
      portSelection.command = 'hardwario.tower.changeDevice';
      portSelection.show();
      contextGlobal.subscriptions.push(portSelection);
    }
  }));

  /**
   * Send message to web view to clear the whole log
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.clearConsole', () => {
    webViewProvider.clearData();
  }));

  /**
   * Attach console to the selected serial port
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.connectConsole', () => {
    if (selectedPort === '') {
      vscode.window.showWarningMessage('No HARDWARIO TOWER module connected. Please connect it and try again.');
      return;
    }

    if (serialConsole === undefined) {
      serialConsole = new SerialPortConsole(selectedPort);
      vscode.commands.executeCommand('hardwario.tower.clearConsole');
      serialConsole.connect(addSerialData, false).then(() => {
        webViewProvider.consoleConnected(`${selectedPort} ${selectedPortNumber}`, serialConsole);
        vscode.commands.executeCommand('setContext', 'hardwario.tower.consoleConnected', true);
      });
    }
  }));

  /**
   * Disconnect attached serial console to free the serial port
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.disconnectConsole', () => {
    disconnectingConsole = true;
    if (serialConsole !== undefined) {
      serialConsole.disconnect();
      serialConsole = undefined;
      webViewProvider.consoleDisconnected();
      vscode.commands.executeCommand('setContext', 'hardwario.tower.consoleConnected', false);
    }
  }));

  /**
   * Restart device attached to the console
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.restartDevice', () => {
    if (serialConsole !== undefined) {
      vscode.commands.executeCommand('hardwario.tower.clearConsole');
      serialConsole.resetDevice();
    }
  }));

  /**
   * Save the console log to selected file
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.saveLog', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const dateLongString = new Date().toISOString().split('.')[0].replace(/[^\d]/gi, '');

    const fileDefaultUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath.toString(), `hio-code-${dateLongString}.log`));

    const options: vscode.SaveDialogOptions = {
      title: 'Save log file',
      saveLabel: 'Save Log',
      defaultUri: fileDefaultUri,
    };
    vscode.window.showSaveDialog(options).then((uri) => {
      if (uri) {
        let fileUriString = '';
        if (helpers.WINDOWS) {
          fileUriString = `${uri.path.substring(1)}/`;
        } else if (helpers.LINUX || helpers.MACOS) {
          fileUriString = `${uri.path}/`;
        }

        fileUriString = fileUriString.substring(0, fileUriString.length - 1);
        const fileExtension = fileUriString.substring(fileUriString.length - 4, fileUriString.length);

        if (fileExtension !== '.log') {
          fileUriString += '.log';
        }

        webViewProvider.saveLog(fileUriString);
      }
    });
  }));

  /**
   * Scroll the web view back to bottom and turn on auto scroll
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.scrollToBottom', () => {
    webViewProvider.turnOnAutoScroll();
  }));

  /**
   * Show the input field in the bottom of the HARDWARIO Console
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.consoleInput', () => {
    webViewProvider.showInput();
  }));

  /**
   * Clear all builded binaries
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.clean', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'out'), { recursive: true, force: true });
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'obj'), { recursive: true, force: true });
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'firmware.bin'), { force: true });
    vscode.window.showInformationMessage('Clean All Outputs: Success');
  }));

  /**
   * Attach the console to the selected device for the logging messages
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.console', () => {
    webViewProvider.showWebView().then(() => {
      helpers.sleep(500);
      if (serialConsole !== undefined) {
        if (serialConsole.port.port.openOptions.path === selectedPort) {
          vscode.commands.executeCommand('hardwario.tower.restartDevice');
        } else {
          attachingConsole = true;
          vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
          vscode.commands.executeCommand('hardwario.tower.connectConsole');
        }
      } else {
        vscode.commands.executeCommand('hardwario.tower.connectConsole');
      }
    });
  }));

  /**
   * Build and upload firmware to selected device.
   * After the upload the console will be attached to the device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashAndLog', () => {
    helpers.checkDirtyFiles();

    if (serialConsole !== undefined) {
      vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
    }

    flashAfterBuild = true;
    logAfterFlash = true;

    vscode.commands.executeCommand('hardwario.tower.build');
  }));

  /**
   * Build and debug firmware for selected device with JLink
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashAndDebug', async () => {
    preDebugBuildActive = true;
    vscode.commands.executeCommand('hardwario.tower.build');
  }));

  /**
   * Start debug with JLink on selected device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.debug', async () => {
    helpers.startDebug();
  }));

  /**
   * Change the type of the built firmware (debug/release)
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.changeBuildType', () => {
    if (buildType === 'Debug') {
      buildType = 'Release';
    } else {
      buildType = 'Debug';
    }
    releaseBar.text = `Build type: ${buildType}`;
  }));

  /**
   * Internal command that finds the arm toolchain based on the portable version
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.locateToolchain', () => {
    if (helpers.isPortable()) {
      if (helpers.WINDOWS || helpers.LINUX) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/gcc/bin/arm-none-eabi-gdb`;
      }
      if (helpers.MACOS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/gcc/bin/arm-none-eabi-gdb`;
      }
    }
    return 'arm-none-eabi-gdb';
  }));

  /**
     * Internal command that finds the JLink based on the portable version
     */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.locateJlink', () => {
    if (helpers.isPortable()) {
      if (helpers.WINDOWS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/SEGGER/JLink/JLinkGDBServerCL`;
      }
      if (helpers.MACOS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
      }
      if (helpers.LINUX) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
      }
    } else {
      if (helpers.LINUX || helpers.MACOS) {
        return 'JLinkGDBServerCLExe';
      }
      if (helpers.WINDOWS) {
        return 'JLinkGDBServerCL';
      }
    }
    return 'JLinkGDBServerCL';
  }));

  /**
   * Update firmware SDK
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.updateSdk', () => {
    cloneTerminal.get().sendText('git submodule update --remote --merge && exit');
  }));

  /**
   * Upgrade firmware project from platformio
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.upgradeFirmware', () => {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath.toString();

    helpers.updateToSupportedFirmwareStructure(workspacePath);
  }));
}

/**
 * Creates the icons on the bottom panel of the VSCode and assigns the commands to them
 * @param context vscode context
 */
function createToolbar(context: vscode.ExtensionContext) {
  const build = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  build.name = 'HARDWARIO: Toolbar';
  build.text = '$(check)';
  build.tooltip = 'HARDWARIO: Build Firmware';
  build.command = 'hardwario.tower.build';
  build.show();
  context.subscriptions.push(build);

  const flashCommand = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  flashCommand.name = 'HARDWARIO: Toolbar';
  flashCommand.text = '$(arrow-up)';
  flashCommand.tooltip = 'HARDWARIO: Flash Firmware';
  flashCommand.command = 'hardwario.tower.flashToDevice';
  flashCommand.show();
  context.subscriptions.push(flashCommand);

  const console = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  console.name = 'HARDWARIO: Toolbar';
  console.text = '$(debug-alt)';
  console.tooltip = 'HARDWARIO: Build + Flash (Console)';
  console.command = 'hardwario.tower.flashAndLog';
  console.show();
  context.subscriptions.push(console);

  const clean = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  clean.name = 'HARDWARIO: Toolbar';
  clean.text = '$(notebook-delete-cell)';
  clean.tooltip = 'HARDWARIO: Clean All Outputs';
  clean.command = 'hardwario.tower.clean';
  clean.show();
  context.subscriptions.push(clean);

  releaseBar = vscode.window.createStatusBarItem(
    'toolbar',
    vscode.StatusBarAlignment.Left,
    1,
  );

  releaseBar.name = 'HARDWARIO: Toolbar';
  releaseBar.text = `Build type: ${buildType}`;
  releaseBar.tooltip = 'HARDWARIO: Change release type';
  releaseBar.command = 'hardwario.tower.changeBuildType';
  releaseBar.show();
  context.subscriptions.push(releaseBar);
}

/**
 * Simple function to remove last session attached device if there was any
 */
function removeDeviceAtStartup() {
  const removeDeviceStartupInterval = setInterval(() => {
    if (webViewProvider.view !== undefined) {
      webViewProvider.removeDevice();
      clearInterval(removeDeviceStartupInterval);
    }
  }, 100);
}

/**
 * Setup the rest of the extension (not based on portable version)
 */
function setup() {
  createToolbar(contextGlobal);

  pushGeneralCommands();
  pushHardwarioCommands();

  helpers.addSetting();

  vscode.window.registerTreeDataProvider('hardwario.tower.views.palette', new PaletteProvider());
}

/**
 * Sets up the extension in full if the VSCode is not portable
 */
function setupNormal() {
  if (helpers.WINDOWS) {
    helpers.checkCommand('git', 'Please install git, add it to PATH and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make, add it to PATH and restart VSCode', 'How to install make', 'Cancel', 'https://www.technewstoday.com/install-and-use-make-in-windows/');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc, add it to PATH and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-windows');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');
  } else if (helpers.LINUX) {
    helpers.checkCommand('git', 'Please install git and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make and restart VSCode', 'How to install make', 'Cancel', 'https://linuxhint.com/install-make-ubuntu/');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-linux');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');
  } else if (helpers.MACOS) {
    helpers.checkCommand('git', 'Please install git and restart VSCode', 'How to install git', 'Cancel', 'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    helpers.checkCommand('make', 'Please install make and restart VSCode', 'How to install make', 'Cancel', 'https://formulae.brew.sh/formula/make');
    helpers.checkCommand('arm-none-eabi-gcc', 'Please install arm-none-eabi-gcc and restart VSCode', 'How to install arm-none-eabi-gcc', 'Cancel', 'https://mynewt.apache.org/latest/get_started/native_install/cross_tools.html#installing-the-arm-toolchain-for-mac-os-x');
    helpers.checkCommand('cmake', 'Please install CMake, add if to PATH and restart VSCode', 'How to install CMake', 'Cancel', 'https://cmake.org/install/');
    helpers.checkCommand('ninja', 'Please install Ninja, add if to PATH and restart VSCode', 'How to install Ninja', 'Cancel', 'https://github.com/ninja-build/ninja/releases');
  }
  setup();
}

/**
 * Sets up the extension in full if the VSCode is portable
 */
function setupPortable() {
  setup();
}

/**
 * Activation function that fires at the start of VSCode
 * Takes care of setting up the command palette and all of the commands
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  contextGlobal = context;

  vscode.window.onDidCloseTerminal((terminal) => {
    if (cloneTerminal.instance !== null && terminal === cloneTerminal.get()) {
      if (lastSelectedFolder !== '') {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(lastSelectedFolder));
        lastSelectedFolder = '';
      }
    }
  });

  webViewProvider = new ConsoleWebViewProvider(contextGlobal.extensionUri);
  vscode.window.registerWebviewViewProvider(ConsoleWebViewProvider.viewType, webViewProvider);
  removeDeviceAtStartup();

  /**
   * If the open folder is HARDWARIO TOWER firmware the extension will be started in full
   */
  if (helpers.isHardwarioProject()) {
    /**
    * Looks for the HARDWARIO TOWER devices connected to the computer by a serial port
    * every 2 seconds
    */
    setInterval(() => {
      SerialPort.list().then((ports) => {
        let index = 0;
        const portsLen = ports.length;
        for (let i = 0; i < portsLen; i += 1) {
          if (ports[index].serialNumber === undefined || (!ports[index].serialNumber.includes('usb-dongle') && !ports[index].serialNumber.includes('core-module'))) {
            ports.splice(index, 1);
          } else {
            index += 1;
          }
        }
        if (JSON.stringify(ports) === JSON.stringify(serialPorts)) {
          return;
        }
        serialPorts = ports;
        if (portSelection !== null) {
          portSelection.dispose();
          portSelection = null;
        }

        if (portSelection === null) {
          if (deviceIndex >= serialPorts.length) {
            deviceIndex = serialPorts.length - 1;
          }

          if (ports.length !== 0) {
            selectedPort = ports[deviceIndex].path;
            selectedPortNumber = ports[deviceIndex].serialNumber;
          } else {
            selectedPort = '';
            selectedPortNumber = '';
            deviceIndex = 0;
          }
          portSelection = vscode.window.createStatusBarItem(
            'toolbar',
            vscode.StatusBarAlignment.Left,
            1,
          );

          portSelection.name = 'HARDWARIO: Toolbar';

          if (ports.length === 0) {
            portSelection.text = 'No device found!';
          } else {
            portSelection.text = `Device: ${ports[deviceIndex].path} - ${ports[deviceIndex].serialNumber.split('-').slice(0, 3).join('-')}`;
          }
          portSelection.tooltip = 'HARDWARIO: Change device';
          portSelection.command = 'hardwario.tower.changeDevice';
          portSelection.show();
          context.subscriptions.push(portSelection);
        }
      });
    }, 2000);

    /**
    * Selects how to setup the extension based on the type of VSCode
    */
    if (helpers.isPortable()) {
      setupPortable();
    } else {
      setupNormal();
    }
    helpers.checkProjectStructure();

    const provider = new HardwarioTowerDebugConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('hardwario-debugger', provider));

    vscode.commands.executeCommand('setContext', 'hardwario.tower.hardwarioProject', true);

    hardwarioOutputChannel = vscode.window.createOutputChannel('HARDWARIO TOWER');

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    if (fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), 'src', 'application.c'))) {
      vscode.workspace.openTextDocument(path.join(workspaceFolder.uri.fsPath.toString(), 'src', 'application.c')).then((textDocument) => {
        vscode.window.showTextDocument(textDocument);
      });
    }
  } else {
    pushGeneralCommands();
    vscode.window.registerTreeDataProvider('hardwario.tower.views.palette', new PaletteProvider());
    vscode.commands.executeCommand('setContext', 'hardwario.tower.hardwarioProject', false);
  }
}

export function deviceDisconnected() {
  if (!attachingConsole && !disconnectingConsole) {
    vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
  }
  if (attachingConsole) {
    attachingConsole = false;
  }
  if (disconnectingConsole) {
    disconnectingConsole = false;
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

/**
 * Debug configuration with HARDWARIO TOWER Debug name
 * Calls preDebugBuild function if no launch.json is present
 */
class HardwarioTowerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(_folder: vscode.WorkspaceFolder |
    undefined, config: vscode.DebugConfiguration):vscode.ProviderResult<vscode.DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'c' && helpers.isHardwarioProject()) {
        preDebugBuild();
        preDebugBuildActive = true;
      }
    }
    return undefined;
  }
}
