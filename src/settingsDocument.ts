import * as vscode from 'vscode';
import { VersionManager } from './versionManager';

export class SettingsDocument {

	constructor(private document: vscode.TextDocument, private verMgr: VersionManager) { }

	public provideCompletionItems(position: vscode.Position, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem[]> {
		const location = this.document.getText().length +  this.document.offsetAt(position);
        const currentLine = this.document.lineAt(position.line).text;
		const range = this.document.getWordRangeAtPosition(position) || new vscode.Range(position, position);

		const allConfig = this.getAllDependencies(this.document.getText());

		if (currentLine.search("\"builtin-baseline\"") >= 0)
		{
			return this.getMatchedBuiltinBaseline(allConfig);
		}
		
		const currDependencyName = this.currentDependencyName(currentLine, this.document.getText(), allConfig);
		if (currDependencyName.length)
		{
			return this.getMatchedVersions(currDependencyName, allConfig);
		}

		const completionItems : vscode.CompletionItem[] = [];
		return completionItems;
	}

	private getDependencyName(line: string)
	{
		let tmp = line.indexOf("\"name\"");
		tmp = tmp + "\"name\"".length;
		let start = line.indexOf("\"", tmp);
		let end = line.indexOf("\"", start + 1);
		return line.substring(start + 1, end);
	}

	private getDependencyVersion(line: string)
	{
		let tmp;
		if (line.indexOf("\"version>=\"") !== -1)
		{
			tmp = line.indexOf("\"version>=\"");
			tmp = tmp + "\"version>=\"".length;
		}
		else
		{
			tmp = line.indexOf("\"version\"");
			tmp = tmp + "\"version\"".length;
		}
		let start = line.indexOf("\"", tmp);
		let end = line.indexOf("\"", start + 1);
		return line.substring(start + 1, end);
	}

	private getAllDependencies(configText: string)
	{
		let configs = new Array<{name: string, version: string}>;
		let lines = configText.split('\n');
	
		let start = false;
		let single = false;
		let tmpName = "";
		for (let line of lines)
		{
			if (line.search('\"dependencies\"') !== -1)
			{
				start = true;
				continue;
			}

			if (start)
			{
				if (line.search(']') !== -1)
				{
					break;
				}
				else if (line.search('}') !== -1)
				{
					single = false;
				}
				else if (line.search('{') !== -1)
				{
					single = true;
				}
				else 
				{
					if (single)
					{
						if (line.search("\"name\"") !== -1)
						{
							// new item but the last item has no version declaration, so put into array without version.
							if (tmpName.length)
							{
								configs.push({name : tmpName, version: ""});
								tmpName = "";
							}
							tmpName = this.getDependencyName(line);
						}
						else if (line.search("\"version>=\"") !== -1 && line.search("\"version\"") !== -1)
						{
							configs.push({name : tmpName, version: this.getDependencyVersion(line)});
							tmpName = "";
						}
					}
					else
					{
						// not version specific
						let start = line.indexOf("\"");
						let end = line.indexOf("\"", start + 1);
						let name = line.substring(start + 1, end);
						if (name.length)
						{
							configs.push({name: name, version: ""});
						}
					}
				}
			}
		}

		let configsWithVersion = new Array<{name: string, version: string, hash: string}>;
		for (let single in configs)
		{
			let hash = this.verMgr.getPortVersionHash(configs[single].name, configs[single].version);
			configsWithVersion.push({name: configs[single].name, version: configs[single].version, hash: hash});
		}

		return configsWithVersion;
	}

	private currentDependencyName(currentLine: string, configText: string,allConfig: Array<Object>)
	{
		if (currentLine.search("\"version>=\"") !== -1 && currentLine.search("\"version\"") !== -1 )
		{
			let lines = configText.split('\n');
			for (let line in lines)
			{
				if (currentLine === lines[line])
				{
					if (lines[Number(line) - 1].search("\"name\"") !== -1)
					{
						return this.getDependencyName(lines[Number(line) - 1]);
					}
					else if (lines[Number(line) + 1].search("\"name\"") !== -1)
					{
						return this.getDependencyName(lines[Number(line) + 1]);
					}
					else
					{
						return "";
					}
				}
			}

			return "";
		}
		else
		{
			return "";
		}
	}

	private getMatchedVersions(name: string, allConfig: Array<{name: string, version: string, hash: string}>)
	{
		let versions = this.verMgr.getPortVersions(name);
	
		const completionItems = [];
		for (let single in versions)
		{
			let item = new vscode.CompletionItem(versions[single].version);
			completionItems.push(item);
		}

		return completionItems;
	}

	private getMatchedBuiltinBaseline(configs: Array<{name: string, version: string, hash: string}>)
	{
		const completionItems = [];
		for (let config in configs)
		{
			let item = new vscode.CompletionItem(configs[config].hash);
			completionItems.push(item);
		}

		return completionItems;
	}
}