import * as vscode from 'vscode';
import * as path from 'path';
import { env } from 'process';
import * as helpers from './helpers';

export class Terminal
{
    name: string;
    _instance: any;

    constructor(name) {
        this._instance = null;
        this.name = name;
    }

    get()
    {
        if(this._instance === null)
        {
            let vscodepath = process.env.VSCODE_CWD;
            let towerPath = path.join(vscodepath, 'data', 'tower');

            let pythonPath = path.join(towerPath, 'python');
            let pythonScriptsPath = path.join(pythonPath, 'Scripts');
            let toolchainPath = path.join(towerPath, 'toolchain');
            
            let makeBinPath = path.join(toolchainPath, 'make', 'bin');
            
            let gccPath = path.join(toolchainPath, 'gcc');
            let gccBinPath = path.join(gccPath, 'bin');
            let gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

            let gitPath = path.join(toolchainPath, 'git');
            let gitCmdPath = path.join(gitPath, 'cmd');
            let gitUsrBinPath = path.join(gitPath, 'usr', 'bin');
            let gitMingw64BinPath = path.join(gitPath, 'mingw64', 'bin');

            const envClone = Object.create(process.env);
            
            if(helpers.WINDOWS)
            {
                envClone.PATH += pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
                envClone.Path += pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
            }
            else if(helpers.LINUX)
            {
                let homePath = env.HOME;
                envClone.PATH = homePath + '/.local/bin:' + process.env.PATH;
                envClone.Path = homePath + '/.local/bin:' + process.env.Path;
            }
            
            this._instance = vscode.window.createTerminal({
                name: this.name,
                env: envClone,
              });
            return this._instance;
        }
        else
        {
            return this._instance;
        }
    }
}