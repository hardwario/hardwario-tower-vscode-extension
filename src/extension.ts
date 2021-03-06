/* eslint-disable max-len */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SerialPort } from 'serialport';
import Terminal from './terminal';
import * as helpers from './helpers';
import PaletteProvider from './palette';
import { flash } from './flasher/flasherSerial';
import SerialPortConsole from './console/serialReader';
import ConsoleWebViewProvider from './console/consoleWebView';

// const commandExistsSync = require('command-exists').sync;

/**
 * Instances of all the available terminals
 */
const buildTerminal = new Terminal('HARDWARIO TOWER Build');
const flashTerminal = new Terminal('HARDWARIO TOWER Flash');
const flashAndLogTerminal = new Terminal('HARDWARIO TOWER Flash And Log');
const consoleTerminal = new Terminal('HARDWARIO TOWER Console');
const cleanTerminal = new Terminal('HARDWARIO TOWER Clean');
const cloneTerminal = new Terminal('HARDWARIO TOWER Clone');

/* Last selected folder used on cloning */
let lastSelectedFolder = '';

/* Build type of the firmware */
let releaseType = 'debug';
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

/**
 * Builds the project before the start of the debug session with Jlink
 */
function preDebugBuild() {
  vscode.workspace.saveAll();
  const command = helpers.buildMakeCommand('debug', true);
  buildTerminal.get().sendText(command);
  buildTerminal.get().show();
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
          vscode.workspace.saveAll();

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
                  vscode.workspace.saveAll();

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

/**
 * Create, define and push the advanced commands to the palette
 * when HARDWARIO TOWER firmware is opened
 */
function pushHardwarioCommands() {
  /**
   * Build code with make and create final binary
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.build', () => {
    vscode.workspace.saveAll();

    const command = helpers.buildMakeCommand(releaseType);
    buildTerminal.get().sendText(command);
    buildTerminal.get().show();
  }));

  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flash', async () => {
    vscode.workspace.saveAll();

    if (flashing) {
      vscode.window.showWarningMessage('Wait for the previous flashing to finish');
      return;
    }

    if (serialConsole !== undefined) {
      vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
    }

    if (selectedPort === '') {
      vscode.window.showWarningMessage('No HARDWARIO TOWER module connected. Please connect it and try again');
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
        vscode.window.showInformationMessage(`Flashing to ${selectedPort} - ${selectedPortNumber} successful`);
        if (logAfterFlash) {
          vscode.commands.executeCommand('hardwario.tower.console');
          logAfterFlash = false;
        }
      })
      .catch((e) => {
        flashing = false;
        vscode.window.showWarningMessage(`Flashing to ${selectedPort} - ${selectedPortNumber} failed`);
        vscode.window.showWarningMessage(
          e.toString(),
        );
      }));
  }));

  /**
   * Upload the firmware to the selected connected device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashToDevice', async () => {
    vscode.workspace.saveAll();

    const command = helpers.buildMakeCommand(releaseType, true);

    buildTerminal.get().sendText(command);
    buildTerminal.get().show();
    flashAfterBuild = true;
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
      vscode.window.showWarningMessage('No HARDWARIO TOWER module connected. Please connect it and try again');
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
    if (serialConsole !== undefined) {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFiles: false,
        canSelectFolders: true,
        title: 'Select parent folder for log file',
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
            value: 'logFile.txt',
            title: 'Final Log File Name',
          };

          vscode.window.showInputBox(inputOptions).then((text) => {
            if (text === undefined || text === '') {
              folderUriString += 'logFile.txt';
            } else {
              folderUriString += text;
            }
            webViewProvider.saveLog(folderUriString);
          });
        }
      });
    }
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
    if (helpers.isCmakeProject()) {
      cleanTerminal.get().sendText('ninja -C obj/release clean');
      cleanTerminal.get().sendText('ninja -C obj/debug clean');
    } else {
      cleanTerminal.get().sendText('make clean');
    }
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'out'), { recursive: true, force: true });
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'obj'), { recursive: true, force: true });
    fs.rmSync(path.join(workspaceFolder.uri.fsPath.toString(), 'firmware.bin'), { force: true });
    cleanTerminal.get().show();
  }));

  /**
   * Attach the console to the selected device for the logging messages
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.console', () => {
    attachingConsole = true;
    webViewProvider.showWebView();
    if (serialConsole !== undefined) {
      if (serialConsole.port.port.openOptions.path === selectedPort) {
        vscode.commands.executeCommand('hardwario.tower.restartDevice');
      } else {
        vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
        vscode.commands.executeCommand('hardwario.tower.connectConsole');
      }
    } else {
      vscode.commands.executeCommand('hardwario.tower.connectConsole');
    }
  }));

  /**
   * Build and upload firmware to selected device.
   * After the upload the console will be attached to the device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashAndLog', () => {
    vscode.workspace.saveAll();

    if (serialConsole !== undefined) {
      vscode.commands.executeCommand('hardwario.tower.disconnectConsole');
    }

    const command = helpers.buildMakeCommand(releaseType, true);

    buildTerminal.get().sendText(command);
    buildTerminal.get().show();
    flashAfterBuild = true;
    logAfterFlash = true;
  }));

  /**
   * Build and debug firmware for selected device with JLink
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.flashAndDebug', async () => {
    preDebugBuild();
    preDebugBuildActive = true;
  }));

  /**
   * Start debug with JLink on selected device
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.debug', async () => {
    helpers.startDebug();
  }));

  /**
   * Change the type of builded firmware (debug/release)
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.changeReleaseType', () => {
    if (releaseType === 'debug') {
      releaseType = 'release';
    } else {
      releaseType = 'debug';
    }
    releaseBar.text = `Firmware type: ${releaseType}`;
  }));

  /**
   * Internal command that finds the arm toolchain based on the portable version
   */
  contextGlobal.subscriptions.push(vscode.commands.registerCommand('hardwario.tower.locateToolchain', () => {
    if (helpers.isPortable()) {
      if (helpers.WINDOWS || helpers.LINUX) {
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/gcc/bin/arm-none-eabi-gdb`;
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
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCL`;
      }
      if (helpers.MACOS) {
        return `${process.env.VSCODE_PORTABLE}/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
      }
      if (helpers.LINUX) {
        return `${process.env.VSCODE_CWD}/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe`;
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
    buildTerminal.get().sendText('git submodule update --remote --merge && exit');
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
  releaseBar.text = `Firmware type: ${releaseType}`;
  releaseBar.tooltip = 'HARDWARIO: Change release type';
  releaseBar.command = 'hardwario.tower.changeReleaseType';
  releaseBar.show();
  context.subscriptions.push(releaseBar);
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
    if (buildTerminal.instance !== null && terminal === buildTerminal.get()) {
      if (preDebugBuildActive) {
        preDebugBuildActive = false;
        helpers.startDebug();
      } else if (flashAfterBuild) {
        flashAfterBuild = false;
        vscode.commands.executeCommand('hardwario.tower.flash');
      }
      buildTerminal.instance = null;
    } else if (flashTerminal.instance !== null && terminal === flashTerminal.get()) {
      flashTerminal.instance = null;
    } else if (consoleTerminal.instance !== null && terminal === consoleTerminal.get()) {
      consoleTerminal.instance = null;
    } else if (cleanTerminal.instance !== null && terminal === cleanTerminal.get()) {
      cleanTerminal.instance = null;
    } else if (flashAndLogTerminal.instance !== null && terminal === flashAndLogTerminal.get()) {
      flashAndLogTerminal.instance = null;
    } else if (cloneTerminal.instance !== null && terminal === cloneTerminal.get()) {
      if (lastSelectedFolder !== '') {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(lastSelectedFolder));
        lastSelectedFolder = '';
      }
    }
  });

  webViewProvider = new ConsoleWebViewProvider(contextGlobal.extensionUri);
  vscode.window.registerWebviewViewProvider(ConsoleWebViewProvider.viewType, webViewProvider);

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
