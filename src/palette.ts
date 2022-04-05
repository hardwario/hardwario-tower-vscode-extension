import * as vscode from 'vscode';

export class PaletteProvider implements vscode.TreeDataProvider<PaletteCommand>  {

	data: PaletteCommand[];

	constructor() {
		this.data = [
			new PaletteCommand('Start New TOWER Firmware', [
				new PaletteCommand('From Skeleton Project...', undefined, 'hardwario-tower.clone_skeleton'),
				new PaletteCommand('From Existing Project...', undefined, 'hardwario-tower.clone_firmware')
			]),
			new PaletteCommand('TOWER Firmware Commands', [
				new PaletteCommand('Build & Flash & Attach', undefined, 'hardwario-tower.flash_and_log'),
				new PaletteCommand('Build & Flash & Debug', undefined, 'hardwario-tower.flash_and_debug'),

				new PaletteCommand('Clean All Outputs', undefined, 'hardwario-tower.clean'),
				new PaletteCommand('Build Firmware', undefined, 'hardwario-tower.build'),
				new PaletteCommand('Flash Firmware', undefined, 'hardwario-tower.flash'),

				new PaletteCommand('Attach Console', undefined, 'hardwario-tower.console'),
				new PaletteCommand('Start Debugging', undefined, 'hardwario-tower.debug'),
			]),
			new PaletteCommand('TOWER Resources', [
				new PaletteCommand('Technical Documentation', undefined, 'hardwario-tower.open_documentation'),
				new PaletteCommand('Software Development Kit', undefined, 'hardwario-tower.open_sdk'),
				new PaletteCommand('Projects on Hackster.io', undefined, 'hardwario-tower.open_projects'),
				new PaletteCommand('GitHub Repositories', undefined, 'hardwario-tower.open_github'),
				new PaletteCommand('Discussion Forum', undefined, 'hardwario-tower.open_forum'),
			]),
			new PaletteCommand('Other Resources', [
				new PaletteCommand('HARDWARIO Website', undefined, 'hardwario-tower.open_website'),
				new PaletteCommand('HARDWARIO E-shop', undefined, 'hardwario-tower.open_shop'),
			])
        ];
	}

	getTreeItem(element: PaletteCommand): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PaletteCommand|undefined): vscode.ProviderResult<PaletteCommand[]> {
		if (element === undefined) {
		  return this.data;
		}
		return element.children;
	  }
}

export class PaletteCommand extends vscode.TreeItem {
	children?: PaletteCommand[]|undefined;
	command?: vscode.Command|undefined;

	constructor(
		public readonly  label: string,
		children?: PaletteCommand[],
		command?,
	) {
		super(
			label,
			children === undefined ? vscode.TreeItemCollapsibleState.None :
									 vscode.TreeItemCollapsibleState.Expanded);

		if(command)
        {
            this.command = {
                title: label,
                command
            };
        }
		this.children = children;
	}
}