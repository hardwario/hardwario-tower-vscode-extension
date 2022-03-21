// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Term from './terminal';

import { PaletteProvider, PaletteCommand } from './palette';

import * as fs from 'fs';
import * as path from 'path';

import AdmZip = require("adm-zip");
import { SerialPort } from 'serialport';

import * as cp from "child_process";

let buildTerminal = new Term.Terminal("HARDWARIO TOWER Build");
let flashTerminal = new Term.Terminal("HARDWARIO TOWER Flash");
let flashAndLogTerminal = new Term.Terminal("HARDWARIO TOWER Flash And Log");
let consoleTerminal = new Term.Terminal("HARDWARIO TOWER Console");
let cleanTerminal = new Term.Terminal("HARDWARIO TOWER Clean");

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
	});

	setInterval(()=> { 
		SerialPort.list().then(function(ports){
			ports.forEach(function(port){
				console.log("Port: ", port);
			  })
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

	if (!fs.existsSync(path.join(pythonScriptsPath, "bcf.exe"))) {
		buildTerminal.get().sendText("python -m pip install bcf");
	}

	vscode.window.showInformationMessage("Setup done, you can use HARDWARIO Extension");
	createToolbar(contextGlobal);

	let compileCommand = vscode.commands.registerCommand('hardwario-tower.build', () => {
		vscode.window.showInformationMessage('Compiling');
		buildTerminal.get().sendText("make -j");
		buildTerminal.get().show();
	});

	contextGlobal.subscriptions.push(compileCommand);

	let uploadcommand = vscode.commands.registerCommand('hardwario-tower.flash', async () => {
		vscode.window.showInformationMessage('Uploading');
		
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
		consoleTerminal.get().sendText("bcf log");
		consoleTerminal.get().show();
	});

	let flashAndLog = vscode.commands.registerCommand('hardwario-tower.flashAndLog', () => {
		vscode.window.showInformationMessage('Uploading and logging');

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

	contextGlobal.subscriptions.push(logCommand);

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

	const console = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	console.name = 'HARDWARIO: Toolbar';
	console.text = '$(debug-alt)';
	console.tooltip = 'Open console';
	console.command = 'hardwario-tower.console';
	console.show();
	context.subscriptions.push(console);
}

// this method is called when your extension is deactivated
export function deactivate() {}
