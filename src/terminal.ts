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
            const envClone = Object.create(process.env);
            let vscodepath = process.env.VSCODE_CWD;

            if(!helpers.OSX)
            {            
                let towerPath = path.join(vscodepath, 'data', 'tower');
                let pythonPath = path.join(towerPath, 'python');
                let toolchainPath = path.join(towerPath, 'toolchain');
                let gitPath = path.join(toolchainPath, 'git');

                if(helpers.WINDOWS)
                {
                    let pythonScriptsPath = path.join(pythonPath, 'Scripts');
                    
                    let makeBinPath = path.join(toolchainPath, 'make', 'bin');
                    
                    let gccPath = path.join(toolchainPath, 'gcc');
                    let gccBinPath = path.join(gccPath, 'bin');
                    let gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

                    let gitCmdPath = path.join(gitPath, 'cmd');
                    let gitUsrBinPath = path.join(gitPath, 'usr', 'bin');
                    let gitMingw64BinPath = path.join(gitPath, 'mingw64', 'bin');
                    
                    if(helpers.isPortable)
                    {
                        envClone.PATH += pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
                        envClone.Path += pythonPath + ';' + pythonScriptsPath + ';' + makeBinPath + ';' + gccBinPath + ';' + gccArmBinPath + ';' + gitCmdPath + ';' + gitUsrBinPath + ';' + gitMingw64BinPath;
                    }
                }
                else if(helpers.LINUX)
                {
                    let homePath = env.HOME;

                    let pythonBinPath = path.join(pythonPath, 'install', 'bin');
                    let makePath = path.join(toolchainPath, 'make');
                    let gccArmBinPath = path.join(toolchainPath, 'gcc', 'bin');

                    if(helpers.isPortable)
                    {
                        envClone.PATH = homePath + '/.local/bin:' + pythonBinPath + ':' + makePath + ':' + gccArmBinPath + ':' + process.env.PATH;
                        envClone.Path = homePath + '/.local/bin:' + pythonBinPath + ':' + makePath + ':' + gccArmBinPath + ':' + process.env.PATH;
                    }
                }
            }
            else
            {
                let towerPath = path.join(vscodepath, '..', 'code-portable-data', 'tower');
                let toolchainPath = path.join(towerPath, 'toolchain');
                let gccPath = path.join(toolchainPath, 'gcc');
                let gccBinPath = path.join(gccPath, 'bin');
                let gccArmBinPath = path.join(gccPath, 'arm-none-eabi', 'bin');

                if(helpers.isPortable)
                {
                    envClone.PATH = gccBinPath + ':' + gccArmBinPath + ':' + process.env.PATH;
                    envClone.Path = gccBinPath + ':' + gccArmBinPath + ':' + process.env.PATH;
                }
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