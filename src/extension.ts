// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Term from './terminal';
import * as installer from './install';

import * as fs from 'fs';
import * as path from 'path';

import AdmZip = require("adm-zip");

let bctDone : boolean = false;
let terminal = new Term.Terminal();

let contextGlobal: vscode.ExtensionContext;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	contextGlobal = context;

	let homePath = process.env.USERPROFILE || 'Home';

	let hardwarioDir = path.join(homePath, '.hardwario');
	let tempDir = path.join(hardwarioDir, 'temp');
	let pythonTemp = path.join(tempDir, 'python.zip');
	let pythonDir = path.join(hardwarioDir, 'python');
	let pythonExecutable = path.join(pythonDir, 'python.exe');

	vscode.window.showInformationMessage("Installation started");

	if (!fs.existsSync(hardwarioDir)){
		fs.mkdirSync(hardwarioDir);
	}

	if(!fs.existsSync(pythonDir))
	{
		fs.mkdirSync(pythonDir);
	}

	if(!fs.existsSync(tempDir))
	{
		fs.mkdirSync(tempDir);
	}

	if(!fs.existsSync(pythonTemp))
	{
		installer.installPortablePython(pythonTemp);
	}
	else
	{
		postInstall();
	}
}

export function postInstall()
{
	let homePath = process.env.USERPROFILE || 'Home';

	let hardwarioDir = path.join(homePath, '.hardwario');
	let tempDir = path.join(hardwarioDir, 'temp');
	let pythonTemp = path.join(tempDir, 'python.zip');
	let pythonDir = path.join(hardwarioDir, 'python');
	let pythonExecutable = path.join(pythonDir, 'python.exe');

	let path_to_pip = path.join(pythonDir, 'get-pip.py');

	let install_pip_text = new String("python ");
	install_pip_text = install_pip_text.concat(path_to_pip);

	terminal.get().sendText(install_pip_text);
	terminal.get().show();
	vscode.window.showInformationMessage("Instalation done");
	createToolbar(contextGlobal);

	let compileCommand = vscode.commands.registerCommand('hardwario-tower.compile', () => {
		vscode.window.showInformationMessage('Compiling');
		if(!bctDone)
		{
			terminal.get().sendText("bct");
			bctDone = true;
		}
		terminal.get().sendText("make -j8");
		terminal.get().show();
	});

	contextGlobal.subscriptions.push(compileCommand);

	let uploadcommand = vscode.commands.registerCommand('hardwario-tower.upload', () => {
		vscode.window.showInformationMessage('Uploading');
		if(!bctDone)
		{
			terminal.get().sendText("bct");
			bctDone = true;
		}
		terminal.get().sendText("make -j8");
		terminal.get().sendText("bcf flash");
		terminal.get().show();
	});

	contextGlobal.subscriptions.push(uploadcommand);

	let clearCommand = vscode.commands.registerCommand('hardwario-tower.clear', () => {
		vscode.window.showInformationMessage('Clearing');
		if(!bctDone)
		{
			terminal.get().sendText("bct");
			bctDone = true;
		}
		terminal.get().sendText("make clean");
		terminal.get().show();
	});

	contextGlobal.subscriptions.push(clearCommand);

	let logCommand = vscode.commands.registerCommand('hardwario-tower.log', () => {
		vscode.window.showInformationMessage('Clearing');
		if(!bctDone)
		{
			terminal.get().sendText("bct");
			bctDone = true;
		}
		terminal.get().sendText("bcf log");
		terminal.get().show();
	});

	contextGlobal.subscriptions.push(logCommand);
}

function createToolbar(context: vscode.ExtensionContext)
{
	const compile = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	compile.name = 'HARDWARIO: Toolbar';
	compile.text = 'Compile';
	compile.tooltip = 'Compile firmware';
	compile.command = 'hardwario-tower.compile';
	compile.show();
	context.subscriptions.push(compile);

	const upload = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	upload.name = 'HARDWARIO: Toolbar';
	upload.text = 'Upload';
	upload.tooltip = 'Upload firmware';
	upload.command = 'hardwario-tower.upload';
	upload.show();
	context.subscriptions.push(upload);

	const clear = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	clear.name = 'HARDWARIO: Toolbar';
	clear.text = 'Clear';
	clear.tooltip = 'Clear build';
	clear.command = 'hardwario-tower.clear';
	clear.show();
	context.subscriptions.push(clear);

	const log = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	log.name = 'HARDWARIO: Toolbar';
	log.text = 'Log';
	log.tooltip = 'Log output';
	log.command = 'hardwario-tower.log';
	log.show();
	context.subscriptions.push(log);
}

// this method is called when your extension is deactivated
export function deactivate() {}
