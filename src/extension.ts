// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Terminal from './terminal';

let bctDone : boolean = false;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hardwario-tower" is now active!');

	const item = vscode.window.createStatusBarItem(
		'toolbar',
		vscode.StatusBarAlignment.Left,
		1);

	item.name = 'HARDWARIO: Toolbar';
	item.text = 'Compile';
	item.tooltip = 'Compile firmware';
	item.command = 'hardwario-tower.compile';
	item.show();
	context.subscriptions.push(item);

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

	const envClone = Object.create(process.env);
	envClone.PATH = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script";
	envClone.Path = "C:\\Users\\Kubaa\\BigClown_Toolchain\\script";
	let term = vscode.window.createTerminal({
		name: 'HARDWARIO TOWER',
		env: envClone,
		shellPath: "C:\\Windows\\System32\\cmd.exe"
	  });

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('hardwario-tower.compile', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Compiling');
		if(!bctDone)
		{
			term.sendText("bct");
			bctDone = true;
		}
		term.sendText("make -j8");
		term.show();
	});

	context.subscriptions.push(disposable);

	let uploadcommand = vscode.commands.registerCommand('hardwario-tower.upload', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Compiling');
		if(!bctDone)
		{
			term.sendText("bct");
			bctDone = true;
		}
		term.sendText("bcf flash");
		term.show();
	});

	context.subscriptions.push(uploadcommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}
