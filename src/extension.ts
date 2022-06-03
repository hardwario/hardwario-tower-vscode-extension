// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Term from './terminal';
import * as helpers from './helpers';

import { PaletteProvider } from './palette';

import * as fs from 'fs';
import * as path from 'path';

import { SerialPort } from 'serialport';

const request = require('request');
var commandExistsSync = require('command-exists').sync;

/* URL for the list of firmware available for the HARDWARIO TOWER */
const FIRMWARE_JSON_URL = "https://firmware.hardwario.com/tower/api/v1/list";

/**
 * Instances of all the available terminals
 */
let buildTerminal = new Term.Terminal("HARDWARIO TOWER Build");
let flashTerminal = new Term.Terminal("HARDWARIO TOWER Flash");
let flashAndLogTerminal = new Term.Terminal("HARDWARIO TOWER Flash And Log");
let consoleTerminal = new Term.Terminal("HARDWARIO TOWER Console");
let cleanTerminal = new Term.Terminal("HARDWARIO TOWER Clean");
let cloneTerminal = new Term.Terminal("HARDWARIO TOWER Clone");


let lastSelectedFolder = "";

/* Build type of the firmware */
let releaseType = "debug";
let releaseBar: vscode.StatusBarItem;

let contextGlobal: vscode.ExtensionContext;

/* List of serial ports available for flashing */
let serialPorts;

/* Currently selected serial port (item on the bottom bar) */
let portSelection : vscode.StatusBarItem = null;

/* Actual name of currently selected serial port */
let selectedPort = "";

/* Index of currently selected device on serial port */
let deviceIndex = 0;

let preDebugBuildActive = false;

/**
 * Activation function that fires at the start of VSCode
 * Takes care of setting up the command palette and all of the commands
 * @param context 
 */
export function activate(context: vscode.ExtensionContext) {
	contextGlobal = context;

	vscode.window.onDidCloseTerminal((terminal) => {
		if(buildTerminal._instance !== null && terminal === buildTerminal.get())
		{
			if(preDebugBuildActive)
			{
				preDebugBuildActive = false;
				startDebug();
			}
			buildTerminal._instance = null;
		}
		else if(flashTerminal._instance !== null &&terminal === flashTerminal.get())
		{
			flashTerminal._instance = null;
		}
		else if(consoleTerminal._instance !== null &&terminal === consoleTerminal.get())
		{
			consoleTerminal._instance = null;
		}
		else if(cleanTerminal._instance !== null &&terminal === cleanTerminal.get())
		{
			cleanTerminal._instance = null;
		}
		else if(flashAndLogTerminal._instance !== null &&terminal === flashAndLogTerminal.get())
		{
			flashAndLogTerminal._instance = null;
		}
		else if(cloneTerminal._instance !== null &&terminal === cloneTerminal.get())
		{
			if(lastSelectedFolder !== "")
			{
				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(lastSelectedFolder));
				lastSelectedFolder = "";
			}
		}
	});
		
	/**
	 * If the open folder is HARDWARIO TOWER firmware the extension will be started in full
	 */
	if(helpers.isHardwarioProject())
	{		
		/**
		 * Looks for the HARDWARIO TOWER devices connected to the computer by a serial port
		 * Every 2 seconds
		 */
		setInterval(()=> { 
			SerialPort.list().then(function(ports){
				let index = 0;
				let portsLen = ports.length;
				for(let i = 0; i < portsLen; i++)
				{
					if(ports[index].serialNumber === undefined || (!ports[index].serialNumber.includes('usb-dongle') && !ports[index].serialNumber.includes('core-module')))
					{
						ports.splice(index, 1);
					}
					else
					{
						index++;
					}
				}
				if(JSON.stringify(ports) === JSON.stringify(serialPorts))
				{
					return;
				}
				else
				{
					serialPorts = ports; 
					if(portSelection !== null)
					{
						portSelection.dispose();
						portSelection = null;
					}
				}
				
				if(portSelection === null)
				{
					if(deviceIndex >= serialPorts.length)
					{
						deviceIndex = serialPorts.length - 1;
					}
	
					if(ports.length !== 0)
					{
						selectedPort = ports[deviceIndex]['path'];
					}
					else
					{
						selectedPort = "";
						deviceIndex = 0;
					}
					portSelection = vscode.window.createStatusBarItem(
						'toolbar',
						vscode.StatusBarAlignment.Left,
						1);
				
					portSelection.name = 'HARDWARIO: Toolbar';
	
					if(ports.length === 0)
					{
						portSelection.text = 'No device found!';
					}
					else
					{
						portSelection.text = 'Device: ' + ports[deviceIndex]['path'] + ' - ' + ports[deviceIndex]['serialNumber'].split('-').slice(0, 3).join('-') ;
					}
					portSelection.tooltip = 'Change device';
					portSelection.command = 'hardwario-tower.change_device';
					portSelection.show();
					context.subscriptions.push(portSelection);
				}
			  });
		}, 2000);
	
		/**
		 * Selects how to setup the extension based on the type of VSCode
		 */
		if(helpers.isPortable())
		{
			setupPortable();
		}
		else
		{
			setupNormal();
		}
		helpers.checkProjectStructure();

		const provider = new HardwarioTowerDebugConfigurationProvider();
		context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('hardwario-debugger', provider));
	}
	/**
	 * If the open folder is not HARDWARIO TOWER firmware the extension will be initialized in a limited mode
	 */
	else
	{
		pushGeneralCommands();
		vscode.window.registerTreeDataProvider('palette', new PaletteProvider());
	}
}

/**
 * Sets up the extension in full if the VSCode is not portable
 */
function setupNormal()
{
	if(helpers.WINDOWS)
	{
		helpers.checkCommand('git', "Please install git, add it to PATH and restart VSCode", "How to install git", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('make', "Please install make, add it to PATH and restart VSCode", "How to install make", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('arm-none-eabi-gcc', "Please install arm-none-eabi-gcc, add it to PATH and restart VSCode", "How to install arm-none-eabi-gcc", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('rm', "Please install linux commands, add them to PATH and restart VSCode", "How to install linux tools", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('bcf', "Please install bcf, add if to PATH and restart VSCode", "How to install bcf", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		
		if(!commandExistsSync('python') && !commandExistsSync('python3')) {
			vscode.window.showWarningMessage("Please install python, add it to PATH and restart VSCode", 
			"How to install python", "Cancel")
			.then(answer => {
				if (answer === "How to install python") {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/git-guides/install-git#install-git-on-linux'));
					return;
				}
			});
		}
	}
	else if(helpers.LINUX || helpers.OSX)
	{
		helpers.checkCommand('git', "Please install git, add it to PATH and restart VSCode", "How to install git", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('make', "Please install make, add it to PATH and restart VSCode", "How to install make", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('arm-none-eabi-gcc', "Please install arm-none-eabi-gcc, add it to PATH and restart VSCode", "How to install arm-none-eabi-gcc", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		helpers.checkCommand('bcf', "Please install bcf, add if to PATH and restart VSCode", "How to install bcf", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');
		
		if(!commandExistsSync('python') && !commandExistsSync('python3')) {
			vscode.window.showWarningMessage("Please install python, add it to PATH and restart VSCode", 
			"How to install python", "Cancel")
			.then(answer => {
				if (answer === "How to install python") {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/git-guides/install-git#install-git-on-linux'));
					return;
				}
			});
		}
	}
	setup();
}

/**
 * Sets up the extension in full if the VSCode is portable
 */
function setupPortable()
{
	let vscodepath = process.env.VSCODE_CWD;
	let towerPath = path.join(vscodepath, 'data', 'tower');

	let pythonPath = path.join(towerPath, 'python');
	let pythonScriptsPath = path.join(pythonPath, 'Scripts');

	if(helpers.WINDOWS)
	{
		if (!fs.existsSync(path.join(pythonScriptsPath, "bcf.exe"))) {
			buildTerminal.get().sendText("python -m pip install bcf");
		}
	}
	else if(helpers.OSX)
	{
		if (!commandExistsSync('bcf')) {
			buildTerminal.get().sendText("python3 -m pip install bcf");
		}
	}
	else if(helpers.LINUX)
	{
		helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", "How to install git", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');

		let pythonBinPath = path.join(towerPath, 'python', 'install', 'bin');
		if (!commandExistsSync(process.env.HOME + '/.local/bin/bcf') && !commandExistsSync(pythonBinPath + '/bcf')) {
			buildTerminal.get().sendText("pip install bcf");
		}
	}	

	setup();
}

/**
 * Setup the rest of the extension (not based on portable version)
 */
function setup()
{
	createToolbar(contextGlobal);

	pushGeneralCommands();
	pushHardwarioCommands();

	helpers.addSetting();
	
	vscode.window.registerTreeDataProvider('palette', new PaletteProvider());
	vscode.window.showInformationMessage("Setup done, you can use HARDWARIO Extension");
}

/**
 * Create, define and push the basic commands to the palette
 */
function pushGeneralCommands()
{
	/**
	 * Clone skeleton firmware from github and open it as a folder
	 */
	let cloneCommand = vscode.commands.registerCommand('hardwario-tower.clone_skeleton', async () => {
		helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", "How to install git", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');

		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			canSelectFiles: false,
			canSelectFolders: true,
			title: "Select Empty Folder For New Firmware",
			openLabel: "Select folder"
	   };
	   vscode.window.showOpenDialog(options).then(folderUri => {
			if (folderUri) {
				let folderUriString = "";
				if(helpers.WINDOWS)
				{
					folderUriString = folderUri[0].path.substring(1) + "/";
				}
				else if(helpers.LINUX || helpers.OSX)
				{
					folderUriString = folderUri[0].path + '/';
				}

				const inputOptions = {
					value : "twr-skeleton",
					title : "Skeleton folder name",
				};

				vscode.window.showInputBox(inputOptions).then((text) => {
					if(text === undefined || text === "")
					{
						folderUriString += "twr-skeleton";
					}
					else
					{
						folderUriString += text;
					}
					cloneTerminal.get().sendText("git clone --recursive https://github.com/hardwario/twr-tester-chester-x0.git " + folderUriString);
					cloneTerminal.get().sendText("exit");
					cloneTerminal.get().show();
					vscode.workspace.saveAll();
	
					lastSelectedFolder = folderUriString;
				});
			}
		});
	});

	contextGlobal.subscriptions.push(cloneCommand);

	/**
	 * Clone selected firmware from the github and open it as a folder
	 */
	let cloneFromTemplateCommand = vscode.commands.registerCommand('hardwario-tower.clone_firmware', async () => {
		helpers.checkCommand('git', "Please install git with 'sudo apt install git' and restart VSCode", "How to install git", "Cancel", 'https://github.com/git-guides/install-git#install-git-on-linux');

		updateFirmwareJson()
		.then((data : string)=>{
			let firmwareList = [];
			const json = JSON.parse(data);
			
			json.forEach(function(firmware){
				firmwareList.push({label: firmware.name.split('/')[1], description: firmware.description, link: firmware.repository + '.git'});
			});

			const quickPickOptions: vscode.QuickPickOptions = {
				placeHolder: "Pick firmware template",
				canPickMany: false,
				title: "Firmware template"
			   };

			vscode.window.showQuickPick(
				firmwareList,
				quickPickOptions).then(pickedItem => {
				if(pickedItem)
				{
					const options: vscode.OpenDialogOptions = {
						canSelectMany: false,
						canSelectFiles: false,
						canSelectFolders: true,
						title: "Select Empty Folder For New Firmware",
						openLabel: "Select folder"
					   };
	
					vscode.window.showOpenDialog(options).then(folderUri => {
						if (folderUri) {
							let folderUriString = "";
							if(helpers.WINDOWS)
							{
								folderUriString = folderUri[0].path.substring(1) + "/";
							}
							else if(helpers.LINUX || helpers.OSX)
							{
								folderUriString = folderUri[0].path + '/';
							}

							const inputOptions = {
								value : pickedItem.label,
								title : "Skeleton folder name",
							};
			
							vscode.window.showInputBox(inputOptions).then((text) => {
								if(text === undefined || text === "")
								{
									folderUriString += pickedItem.label;
								}
								else
								{
									folderUriString += text;
								}
								cloneTerminal.get().sendText("git clone --recursive " + pickedItem.link + ' ' + folderUriString);
								cloneTerminal.get().sendText("exit");
								cloneTerminal.get().show();
								vscode.workspace.saveAll();
				
								lastSelectedFolder = folderUriString;
							});
						}
					});
				}
			});
		})
		.catch((_err)=>{
			console.log("error");
		});
	});

	contextGlobal.subscriptions.push(cloneFromTemplateCommand);

	/**
	 * Open documentation website
	 */
	let documentationCommand = vscode.commands.registerCommand('hardwario-tower.open_documentation', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/'));
	});
	contextGlobal.subscriptions.push(documentationCommand);

	/**
	 * Open SDK website
	 */
	let sdkCommand = vscode.commands.registerCommand('hardwario-tower.open_sdk', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://sdk.hardwario.com/index.html'));
	});
	contextGlobal.subscriptions.push(sdkCommand);

	/**
	 * Open shop website
	 */
	let shopCommand = vscode.commands.registerCommand('hardwario-tower.open_shop', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://shop.hardwario.com'));
	});
	contextGlobal.subscriptions.push(shopCommand);

	/**
	 * Open hackster.io projects website
	 */
	let projectsCommand = vscode.commands.registerCommand('hardwario-tower.open_projects', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://www.hackster.io/hardwario/projects'));
	});
	contextGlobal.subscriptions.push(projectsCommand);

	/**
	 * Open company github page
	 */
	let githubCommand = vscode.commands.registerCommand('hardwario-tower.open_github', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/hardwario'));
	});
	contextGlobal.subscriptions.push(githubCommand);

	/**
	 * Open HARDWARIO Forum
	 */
	let forumCommand = vscode.commands.registerCommand('hardwario-tower.open_forum', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://forum.hardwario.com'));
	});
	contextGlobal.subscriptions.push(forumCommand);

	/**
	 * Open HARDWARIO main website
	 */
	let websiteCommand = vscode.commands.registerCommand('hardwario-tower.open_website', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://www.hardwario.com/cs/kit/'));
	});
	contextGlobal.subscriptions.push(websiteCommand);
}

/**
 * Create, define and push the advanced commands to the palette when HARDWARIO TOWER firmware is opened
 */
function pushHardwarioCommands()
{
	/**
	 * Build code with make and create final binary
	 */
	let compileCommand = vscode.commands.registerCommand('hardwario-tower.build', () => {
		vscode.workspace.saveAll();
		buildTerminal.get().sendText("make -j " + releaseType);
		buildTerminal.get().show();
	});

	contextGlobal.subscriptions.push(compileCommand);

	/**
	 * Build and upload the firmware to the selected connected device
	 */
	let uploadcommand = vscode.commands.registerCommand('hardwario-tower.flash', async () => {
		vscode.workspace.saveAll();
		
		flashTerminal.get().sendText("make -j " + releaseType);
		if(selectedPort !== "")
		{
			flashTerminal.get().sendText("bcf flash --device " + selectedPort);
		}
		else 
		{
			flashTerminal.get().sendText("bcf flash");
		}
		
		flashTerminal.get().show();
	});

	contextGlobal.subscriptions.push(uploadcommand);

	/**
	 * Change selected device where the firmware should be uploaded to
	 */
	let changeDevice = vscode.commands.registerCommand('hardwario-tower.change_device', async () => {	
		if(serialPorts.length === 0)
		{
			return;
		}

		deviceIndex++;
		if(deviceIndex >= serialPorts.length)
		{
			deviceIndex = 0;
		}

		if(portSelection !== null)
		{
			portSelection.dispose();
			portSelection = null;
		}
		if(portSelection === null)
		{
			selectedPort = serialPorts[deviceIndex]['path'];
			portSelection = vscode.window.createStatusBarItem(
				'toolbar',
				vscode.StatusBarAlignment.Left,
				1);
		
			portSelection.name = 'HARDWARIO: Toolbar';

			portSelection.text = 'Device: ' + serialPorts[deviceIndex]['path'] + ' - ' + serialPorts[deviceIndex]['serialNumber'].split('-').slice(0, 3).join('-') ;
		
			portSelection.tooltip = 'Change device';
			portSelection.command = 'hardwario-tower.change_device';
			portSelection.show();
			contextGlobal.subscriptions.push(portSelection);
		}
	});

	contextGlobal.subscriptions.push(changeDevice);

	/**
	 * Clear all builded binaries
	 */
	let clearCommand = vscode.commands.registerCommand('hardwario-tower.clean', () => {
		cleanTerminal.get().sendText("make clean");
		cleanTerminal.get().show();
	});

	contextGlobal.subscriptions.push(clearCommand);

	/**
	 * Attach the console to the selected device for the logging messages
	 */
	let logCommand = vscode.commands.registerCommand('hardwario-tower.console', () => {
		if(selectedPort !== "")
		{
			consoleTerminal.get().sendText("bcf log --device " + selectedPort);
		}
		else
		{
			consoleTerminal.get().sendText("bcf log");
		}
		consoleTerminal.get().show();
	});
	contextGlobal.subscriptions.push(logCommand);

	/**
	 * Build and upload firmware to selected device. After the upload the console will be attached to the device
	 */
	let flashAndLog = vscode.commands.registerCommand('hardwario-tower.flash_and_log', () => {
		vscode.workspace.saveAll();

		if(flashAndLogTerminal._instance !== null)
		{
			flashAndLogTerminal.get().dispose();
			flashAndLogTerminal._instance = null;
		}

		flashAndLogTerminal.get().sendText("make -j " + releaseType);
		if(selectedPort !== "")
		{
			flashAndLogTerminal.get().sendText("bcf flash --log --device " + selectedPort);
		}
		else 
		{
			flashAndLogTerminal.get().sendText("bcf flash --log");
		}
		flashAndLogTerminal.get().show();
	});

	contextGlobal.subscriptions.push(flashAndLog);

	
	let debugCommand = vscode.commands.registerCommand('hardwario-tower.debug', async () => {
		preDebugBuild();
		preDebugBuildActive = true;
	});

	contextGlobal.subscriptions.push(debugCommand);

	/**
	 * Change the type of builded firmware (debug/release)
	 */
	let changeReleaseType = vscode.commands.registerCommand('hardwario-tower.change_release_type', () => {
		if(releaseType === "debug")
		{
			releaseType = "release";
		}
		else
		{
			releaseType = "debug";
		}
		releaseBar.text = "Firmware type: " + releaseType;
	});
	contextGlobal.subscriptions.push(changeReleaseType);

	/**
	 * Internal command that finds the arm toolchain based on the portable version
	 */
	let locateToolchain = vscode.commands.registerCommand('hardwario-tower.locate_toolchain', () => {
		if(helpers.isPortable())
		{
			return process.env.VSCODE_CWD + "/data/tower/toolchain/gcc/bin/arm-none-eabi-gdb";
		}
		else
		{
			return "arm-none-eabi-gdb";
		}
	});

	contextGlobal.subscriptions.push(locateToolchain);

	/**
	 * Internal command that finds the JLink based on the portable version
	 */
	let locateJlink = vscode.commands.registerCommand('hardwario-tower.locate_jlink', () => {
		if(helpers.isPortable())
		{
			return process.env.VSCODE_CWD + "/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCL";
		}
		else
		{
			return "JLinkGDBServerCL";
		}
	});

	contextGlobal.subscriptions.push(locateJlink);
}

/**
 * Builds the project before the start of the debug session with Jlink
 */
function preDebugBuild()
{
	vscode.workspace.saveAll();
	buildTerminal.get().sendText("make -j debug");
	buildTerminal.get().sendText("exit");
	buildTerminal.get().show();
}

/**
 * Starts the debug session with JLink and given configuration
 */
function startDebug()
{
	vscode.debug.startDebugging(undefined, {
		name : 'HARDWARIO TOWER Debug',
		request : 'launch',
		type : 'cortex-debug',
		cwd : '${workspaceFolder}',
		device : 'STM32L083CZ',
		servertype : 'jlink',
		jlinkscript : './sdk/tools/jlink/flash.jlink',
		interface : 'swd',
		serverpath : '${command:hardwario-tower.locate_jlink}',
		svdFile : './sdk/sys/svd/stm32l0x3.svd',
		gdbPath : '${command:hardwario-tower.locate_toolchain}',
		runToEntryPoint : 'application_init',
		executable : '${workspaceFolder}/out/debug/firmware.elf',
		windows : {
			'gdbPath' : '${command:hardwario-tower.locate_toolchain}.exe',
			'serverpath' : '${command:hardwario-tower.locate_jlink}.exe'
		}
	});
}

/**
 * Creates the icons on the bottom panel of the VSCode and assigns the commands to them
 * @param context vscode context
 */
function createToolbar(context: vscode.ExtensionContext)
{
	const build = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	build.name = 'HARDWARIO: Toolbar';
	build.text = '$(check)';
	build.tooltip = 'Build Firmware';
	build.command = 'hardwario-tower.build';
	build.show();
	context.subscriptions.push(build);

	const flash = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	flash.name = 'HARDWARIO: Toolbar';
	flash.text = '$(arrow-up)';
	flash.tooltip = 'Flash Firmware';
	flash.command = 'hardwario-tower.flash';
	flash.show();
	context.subscriptions.push(flash);
	
	const console = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	console.name = 'HARDWARIO: Toolbar';
	console.text = '$(debug-alt)';
	console.tooltip = 'Build & Flash & Attach';
	console.command = 'hardwario-tower.flash_and_log';
	console.show();
	context.subscriptions.push(console);

	const clean = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	clean.name = 'HARDWARIO: Toolbar';
	clean.text = '$(notebook-delete-cell)';
	clean.tooltip = 'Clean All Outputs';
	clean.command = 'hardwario-tower.clean';
	clean.show();
	context.subscriptions.push(clean);

	releaseBar = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	releaseBar.name = 'HARDWARIO: Toolbar';
	releaseBar.text = "Firmware type: " + releaseType;
	releaseBar.tooltip = 'Change release type';
	releaseBar.command = 'hardwario-tower.change_release_type';
	releaseBar.show();
	context.subscriptions.push(releaseBar);
}

/**
 * Downloads and updates the list of available firmware for the HARDWARIO TOWER
 * @returns promise that resolves when the firmware list is downloaded
 */
function updateFirmwareJson() {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    return new Promise((resolve) => {
        request.get(FIRMWARE_JSON_URL, function(_err, _response, body) {

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
        	resolve(body);

    	});
    });
}

// this method is called when your extension is deactivated
export function deactivate() {}


/**
 * Debug configuration with HARDWARIO TOWER Debug name
 * Calls preDebugBuild function if no launch.json is present
 */
class HardwarioTowerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	resolveDebugConfiguration(_folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

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