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

const FIRMWARE_JSON_URL = "https://firmware.hardwario.com/tower/api/v1/list";

let buildTerminal = new Term.Terminal("HARDWARIO TOWER Build");
let flashTerminal = new Term.Terminal("HARDWARIO TOWER Flash");
let flashAndLogTerminal = new Term.Terminal("HARDWARIO TOWER Flash And Log");
let consoleTerminal = new Term.Terminal("HARDWARIO TOWER Console");
let cleanTerminal = new Term.Terminal("HARDWARIO TOWER Clean");
let cloneTerminal = new Term.Terminal("HARDWARIO TOWER Clone");

let lastSelectedFolder = "";
let releaseType = "debug";
let contextGlobal: vscode.ExtensionContext;
let serialPorts;
let portSelection = null;
let selectedPort = "";
let deviceIndex = 0;
let releaseBar;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	contextGlobal = context;
	
	vscode.window.onDidCloseTerminal((terminal) => {
		if(buildTerminal._instance !== null && terminal === buildTerminal.get())
		{
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

	setInterval(()=> { 
		SerialPort.list().then(function(ports){
			let index = 0;
			let portsLen = ports.length
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

	if(helpers.isPortable())
	{
		setupPortable();
	}
	else
	{
		setupNormal();
	}
}

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
	else if(helpers.LINUX)
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

function setup()
{
	createToolbar(contextGlobal);

	let compileCommand = vscode.commands.registerCommand('hardwario-tower.build', () => {
		vscode.workspace.saveAll();
		buildTerminal.get().sendText("make -j " + releaseType);
		buildTerminal.get().show();
	});

	contextGlobal.subscriptions.push(compileCommand);

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

	let clearCommand = vscode.commands.registerCommand('hardwario-tower.clean', () => {
		cleanTerminal.get().sendText("make clean");
		cleanTerminal.get().show();
	});

	contextGlobal.subscriptions.push(clearCommand);

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

	let cloneCommand = vscode.commands.registerCommand('hardwario-tower.clone_skeleton', async () => {
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
				else if(helpers.LINUX)
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

	let cloneFromTemplateCommand = vscode.commands.registerCommand('hardwario-tower.clone_firmware', async () => {
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
							else if(helpers.LINUX)
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
		.catch((err)=>{
			console.log("error");
		});
	});

	contextGlobal.subscriptions.push(cloneFromTemplateCommand);

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

	let documentationCommand = vscode.commands.registerCommand('hardwario-tower.open_documentation', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/'));
	});
	contextGlobal.subscriptions.push(documentationCommand);

	let sdkCommand = vscode.commands.registerCommand('hardwario-tower.open_sdk', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://sdk.hardwario.com/index.html'));
	});
	contextGlobal.subscriptions.push(sdkCommand);

	let shopCommand = vscode.commands.registerCommand('hardwario-tower.open_shop', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://shop.hardwario.com'));
	});
	contextGlobal.subscriptions.push(shopCommand);

	let projectsCommand = vscode.commands.registerCommand('hardwario-tower.open_projects', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://www.hackster.io/hardwario/projects'));
	});
	contextGlobal.subscriptions.push(projectsCommand);

	let githubCommand = vscode.commands.registerCommand('hardwario-tower.open_github', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/hardwario'));
	});
	contextGlobal.subscriptions.push(githubCommand);

	let forumCommand = vscode.commands.registerCommand('hardwario-tower.open_forum', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://forum.hardwario.com'));
	});
	contextGlobal.subscriptions.push(forumCommand);

	let websiteCommand = vscode.commands.registerCommand('hardwario-tower.open_website', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://www.hardwario.com/cs/kit/'));
	});
	contextGlobal.subscriptions.push(websiteCommand);

	let debugCommand = vscode.commands.registerCommand('hardwario-tower.debug', async () => {
		let armGccPath = vscode.workspace.getConfiguration('cortex-debug').get("armToolchainPath");

		if(helpers.isPortable())
		{
			armGccPath = process.env.VSCODE_CWD + "/data/tower/toolchain/gcc/bin/";
			vscode.workspace.getConfiguration('cortex-debug').update('armToolchainPath', armGccPath, true);
			checkJLinkPath();
		}

		else
		{
			if(armGccPath === null) 
			{
				const inputOptions = {
					title : "Please provide path to the arm toolchain folder",
				};
				vscode.window.showInputBox(inputOptions).then((path) => {
					if(path === undefined || path === "")
					{
						vscode.window.showWarningMessage("Please provide path to the arm toolchain");
						return;
					}
					else
					{
						armGccPath = path;
						vscode.workspace.getConfiguration('cortex-debug').update('armToolchainPath', path, true);
						checkJLinkPath();
					}
				});
			}
			else
			{
				checkJLinkPath();
			}
		}
	});

	contextGlobal.subscriptions.push(debugCommand);

	helpers.addCppExtensionSetting();
	
	vscode.window.registerTreeDataProvider('palette', new PaletteProvider());
	vscode.window.showInformationMessage("Setup done, you can use HARDWARIO Extension");
}

function checkJLinkPath()
{
	let serverPath = "";
	if(helpers.WINDOWS)
	{
		serverPath = process.env.VSCODE_CWD + "/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCL.exe";
	}
	else if(helpers.LINUX)
	{
		if (!fs.existsSync('/etc/udev/rules.d/99-jlink.rules')) {
			vscode.window.showWarningMessage("Please update udev rules so the JLink can be started by any user. Use 'sudo cp " 
			+ process.env.VSCODE_CWD + "/data/tower/toolchain/SEGGER/JLink/99-jlink.rules /etc/udev/rules.d/' to copy 'sudo apt-get install libncurses5 libncurses5:i386' to install additional libraries. You WILL need to unplug and plug JLink back again for it to work");
		}
		
		serverPath = process.env.VSCODE_CWD + "/data/tower/toolchain/SEGGER/JLink/JLinkGDBServerCLExe";
	}

	if(!helpers.isPortable())
	{
		if(vscode.workspace.getConfiguration('hardwario-tower').get("jlinkBinPath") === "")
		{
			const inputOptions = {
				title : "Please provide path to the JLinkGDBServerCLExe (JLinkGDBServerCL.exe on Windows)",
			};
			vscode.window.showInputBox(inputOptions).then((path) => {
				if(path === undefined || path === "")
				{
					return;
				}
				else
				{
					serverPath = path;
					vscode.workspace.getConfiguration('hardwario-tower').update('jlinkBinPath', path, true);
					startDebug(serverPath);
				}
			});
		}
		else
		{
			serverPath = vscode.workspace.getConfiguration('hardwario-tower').get("jlinkBinPath");
			
			startDebug(serverPath);
		}
	}
	else
	{
		startDebug(serverPath);
	}

	if(serverPath === "")
	{
		vscode.window.showWarningMessage("Please provide path to the j-link server");
	}

}

function startDebug(serverPath)
{
	vscode.debug.startDebugging(undefined, {
		type: 'cortex-debug',
		name: 'Debug J-Link',
		request: 'launch',
		cwd: "${workspaceRoot}",
		executable: "./out/debug/firmware.elf",
		servertype: "jlink",
		serverpath: serverPath,
		jlinkscript: "./sdk/tools/jlink/flash.jlink",
		device: "STM32L083CZ",
		interface: "swd",
		svdFile: "./sdk/sys/svd/stm32l0x3.svd",
		stopOnEntry: true
	});
}

function createToolbar(context: vscode.ExtensionContext)
{
	const build = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	build.name = 'HARDWARIO: Toolbar';
	build.text = '$(check)';
	build.tooltip = 'Build firmware';
	build.command = 'hardwario-tower.build';
	build.show();
	context.subscriptions.push(build);

	const flash = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	flash.name = 'HARDWARIO: Toolbar';
	flash.text = '$(arrow-up)';
	flash.tooltip = 'Flash firmware';
	flash.command = 'hardwario-tower.flash';
	flash.show();
	context.subscriptions.push(flash);
	
	const console = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	console.name = 'HARDWARIO: Toolbar';
	console.text = '$(debug-alt)';
	console.tooltip = 'Flash and log';
	console.command = 'hardwario-tower.flash_and_log';
	console.show();
	context.subscriptions.push(console);

	const clean = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	clean.name = 'HARDWARIO: Toolbar';
	clean.text = '$(diff-review-close)';
	clean.tooltip = 'Clean output';
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

function updateFirmwareJson() {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    return new Promise((resolve, reject) => {
        request.get(FIRMWARE_JSON_URL, function(err, response, body) {

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
        	resolve(body);

    	});
    });
}

// this method is called when your extension is deactivated
export function deactivate() {}