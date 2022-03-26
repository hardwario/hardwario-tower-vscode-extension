// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Term from './terminal';
import * as helpers from './helpers';

import { PaletteProvider, PaletteCommand } from './palette';

import * as fs from 'fs';
import * as path from 'path';

import AdmZip = require("adm-zip");
import { SerialPort } from 'serialport';

var commandExistsSync = require('command-exists').sync;
const request = require('request');

const FIRMWARE_JSON_URL = "https://firmware.hardwario.com/tower/api/v1/list";

let buildTerminal = new Term.Terminal("HARDWARIO TOWER Build");
let flashTerminal = new Term.Terminal("HARDWARIO TOWER Flash");
let flashAndLogTerminal = new Term.Terminal("HARDWARIO TOWER Flash And Log");
let consoleTerminal = new Term.Terminal("HARDWARIO TOWER Console");
let cleanTerminal = new Term.Terminal("HARDWARIO TOWER Clean");
let cloneTerminal = new Term.Terminal("HARDWARIO TOWER Clone");

let lastSelectedFolder = "";

let contextGlobal: vscode.ExtensionContext;

let serialPorts;

let portSelection = null;

let selectedPort = "";

let deviceIndex = 0;

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
					index++;
				console.log("Port: ", ports[i]);
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

	setup();
}

export function setup()
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
		if (!commandExistsSync('python') || !commandExistsSync('python3') || !commandExistsSync('pip') || !commandExistsSync('pip3')) {
			vscode.window
			.showWarningMessage("Please install python and pip with 'sudo apt install python3', 'sudo apt install python3-pip' and restart VSCode", 
			"How to install Python", "Cancel")
			.then(answer => {
				if (answer === "How to install Python") {
					vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/firmware/platformio-installation/'));
					return;
				}
			})
			return;
		}
		else
		{
			if(!commandExistsSync('make')) {
				vscode.window
				.showWarningMessage("Please install make with 'sudo apt install make' and restart VSCode", 
				"How to install make", "Cancel")
				.then(answer => {
					if (answer === "How to install make") {
						vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/firmware/platformio-installation/'));
						return;
					}
				})
				return;
			}
			if(!commandExistsSync('git')) {
				vscode.window
				.showWarningMessage("Please install git with 'sudo apt install git' and restart VSCode", 
				"How to install git", "Cancel")
				.then(answer => {
					if (answer === "How to install git") {
						vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/firmware/platformio-installation/'));
						return;
					}
				})
				return;
			}
			if(!commandExistsSync('arm-none-eabi-gcc')) {
				vscode.window
				.showWarningMessage("Please install arm-none-eabi-gcc with 'sudo apt install gcc-arm-none-eabi' and restart VSCode", 
				"How to install gcc-arm-none-eabi", "Cancel")
				.then(answer => {
					if (answer === "How to install gcc-arm-none-eabi") {
						vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/firmware/platformio-installation/'));
						return;
					}
				})
				return;
			}
			if (!commandExistsSync(process.env.HOME + '/.local/bin/bcf')) {
				vscode.window
				.showWarningMessage("Please install bcf with 'pip install bcf' and restart VSCode", 
				"How to install bcf", "Cancel")
				.then(answer => {
					if (answer === "How to install bcf") {
						vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/firmware/platformio-installation/'));
						return;
					}
				})
				return;
			}
		}
	}	

	vscode.window.showInformationMessage("Setup done, you can use HARDWARIO Extension");
	createToolbar(contextGlobal);

	let compileCommand = vscode.commands.registerCommand('hardwario-tower.build', () => {
		vscode.workspace.saveAll();
		vscode.window.showInformationMessage('Compiling');
		buildTerminal.get().sendText("make -j");
		buildTerminal.get().show();
	});

	contextGlobal.subscriptions.push(compileCommand);

	let uploadcommand = vscode.commands.registerCommand('hardwario-tower.flash', async () => {
		vscode.window.showInformationMessage('Uploading');

		vscode.workspace.saveAll();
		
		flashTerminal.get().sendText("make -j");
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
		vscode.window.showInformationMessage('Cleaning');
		cleanTerminal.get().sendText("make clean");
		cleanTerminal.get().show();
	});

	contextGlobal.subscriptions.push(clearCommand);

	let logCommand = vscode.commands.registerCommand('hardwario-tower.console', () => {
		vscode.window.showInformationMessage('Logging');
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
		vscode.window.showInformationMessage('Uploading and logging');

		vscode.workspace.saveAll();

		if(flashAndLogTerminal._instance !== null)
		{
			flashAndLogTerminal.get().dispose();
			flashAndLogTerminal._instance = null;
		}

		flashAndLogTerminal.get().sendText("make -j");
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
		vscode.window.showInformationMessage('Cloning');
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
				cloneTerminal.get().sendText("git clone --recursive https://github.com/hardwario/twr-tester-chester-x0.git " + folderUriString);
				cloneTerminal.get().sendText("exit");
				cloneTerminal.get().show();
				console.log('Selected folder: ' + folderUri[0].path);
				vscode.workspace.saveAll();

				lastSelectedFolder = folderUriString;
			}
		});

		vscode.window.showInformationMessage('Done');

	});

	contextGlobal.subscriptions.push(cloneCommand);

	let cloneFromTemplateCommand = vscode.commands.registerCommand('hardwario-tower.clone_firmware', async () => {
		vscode.window.showInformationMessage('Cloning');

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
							cloneTerminal.get().sendText("git clone --recursive " + pickedItem.link + ' ' + folderUriString);
							cloneTerminal.get().sendText("exit");
							cloneTerminal.get().show();
							console.log('Selected folder: ' + folderUri[0].path);
							vscode.workspace.saveAll();
			
							lastSelectedFolder = folderUriString;
						}
					});
				}
			});
		})
		.catch((err)=>{
			console.log("error");
		});

		
		vscode.window.showInformationMessage('Done');

	});

	contextGlobal.subscriptions.push(cloneFromTemplateCommand);

	let documentationCommand = vscode.commands.registerCommand('hardwario-tower.open_documentation', () => {
		vscode.env.openExternal(vscode.Uri.parse('https://tower.hardwario.com/en/latest/'));
	});
	contextGlobal.subscriptions.push(documentationCommand);

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

	vscode.window.registerTreeDataProvider('pallete', new PaletteProvider());
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
