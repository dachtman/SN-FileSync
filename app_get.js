// Copyright (c) 2014 Fruition Partners, Inc.
var fs = require('graceful-fs');
var chokidar = require('graceful-chokidar');
var path = require('path');
var restify = require('restify');
var url = require('url');
var moment = require('moment');
var readline = require('readline');
var async = require('async');
var diff = require('diff');
require('colors');

var CONFIG_FILE = path.join(__dirname, './app_get.config.json');
var DEFAULTPROMPT = "What action would you like to perform? ";
var DEFAULTCOMPLETIONS = "install create setup-folders add-table test-connection sync-files list-instances list-tables remove-instance remove-table remove-field inspect watch exit".split(" ").sort();
var WATCHER;
var completions = DEFAULTCOMPLETIONS;

var configData = {};
var promptData = [];
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: inputCompleter
});

var appGet = {
	installFileSync: function(rootDirectory) {
		console.log(Object.keys(configData).length === 0);
		if (configData) {
			createConfigFile(rootDirectory);
		} else {
			configData.root = rootDirectory;
		}
		showStartPrompt();
	},

	upsertInstanceInfo: function(name, instanceUrl, userName, password, readonly, jsonVer) {
		instanceUrl = "https://" + instanceUrl.toLowerCase() + ".service-now.com";
		configData.instances[name] = {
			"host": instanceUrl,
			"auth": encodeCredentials(userName || "admin", password || "admin"),
			"last_synced": "1969-12-31 23:59:59",
			"json": (jsonVer == "JSON" || jsonVer == "JSONv2") ? jsonVer : "JSON",
			"readonly": readonly || false
		};
		showStartPrompt();
	},

	upsertTableInfo: function(name, table, field, key, fileType) {
		var wasUpdate = true;
		fileType = fileType || "js";
		key = key || "name";

		if (!configData.folders[name]) {
			wasUpdate = false;
			configData.folders[name] = {};
			configData.folders[name].fields = {};
		}
		configData.folders[name].table = table;
		configData.folders[name].key = key;
		configData.folders[name].fields[fileType] = field;

		if (wasUpdate) {
			console.log("Config Updated:".green, name);
		} else {
			console.log("Config Created:".green, name);
		}
		showStartPrompt();
	},

	upsertFolderStructure: function(instanceName) {
		if (instanceName && !configData.instances[instanceName]) {
			console.log("No Instance In Config:".red, instanceName.bold.red);
			return;
		}
		var instanceArray = instanceName ? [instanceName] : Object.keys(configData.instances).sort();
		instanceArray.forEach(function(instance) {
			var pathName = path.join(configData.root, instance);
			var tableArray = Object.keys(configData.folders).sort();
			createFolder(pathName);
			tableArray.forEach(function(folder) {
				var tablePathName = path.join(pathName, folder);
				createFolder(tablePathName);
			});
		});
		showStartPrompt();
	},

	testConnection: function(instanceName) {
		var instanceArray = instanceName ? [instanceName] : Object.keys(configData.instances).sort();
		async.eachSeries(
			instanceArray,
			sendRestMessage,
			function(err) {
				console.log("TEST COMPLETED".blue);
				showStartPrompt();
			}
		);
	},

	stopWatch: function() {
		WATCHER.close();
		showStartPrompt();
	},

	watchFolders: function() {
		var instances = Object.keys(configData.instances).sort();
		var rootDirectory = configData.root;
		var watchedFolders = [];
		instances.forEach(function(instance) {
			if (configData.instances[instance].readonly == "false") {
				watchedFolders.push(path.join(rootDirectory, instance));
				console.log("Watching:", instance.cyan);
			}
		});
		WATCHER = chokidar.watch(watchedFolders, {
				persistent: true,
				ignoreInitial: true
			})
			.on("all", onFileEvent)
			.on("error", function(error) {
				console.log("Error:".red, error);
				showStartPrompt();
			});
		promptData = [];
		rl.setPrompt("To stop watching, enter stop.\n");
		rl.prompt();
	},

	grabInstanceFiles: function(instanceName, tableName) {
		if (instanceName && !configData.instances[instanceName]) {
			console.log("Instance Not Exist:".red, instanceName.bold);
			return;
		}
		if (tableName && !configData.folders[tableName]) {
			console.log("Folder Not Exist:".red, tableName.bold);
			return;
		}
		var seriesArray = getSeriesArray(instanceName, tableName);
		async.eachSeries(
			seriesArray,
			iterateInstanceObject,
			function(err) {
				console.log("Sync Complete".blue);
				showStartPrompt();
			}
		);
	},

	inspectFile: function(instanceName, tableName, fileName) {
		if (instanceName && !configData.instances[instanceName]) {
			console.log("Instance Not Exist:".red, instanceName.bold);
			return;
		}
		if (tableName && !configData.folders[tableName]) {
			console.log("Folder Not Exist:".red, tableName.bold);
			return;
		}

		var rootFolder = configData.root;
		var instanceArray = instanceName ? [instanceName] : Object.keys(configData.instances).sort();
		var tableArray = tableName ? [tableName] : Object.keys(configData.folders).sort();
		for (var i = 0; i != instanceArray.length; i++) {
			var instance = instanceArray[i];
			for (var x = 0; x != tableArray.length; x++) {
				var table = tableArray[x];
				if(table == "ui_pages"){
					showStartPrompt();
					return;
				}
				var basePath = path.join(rootFolder, instance, table);
				var fileArray = fileName ? [fileName] : fs.readdirSync(basePath)
					.sort()
					.filter(function(element) {
						return element.indexOf(".settings.json") == -1;
					});
				async.eachSeries(
					fileArray,
					function(file, fileCallback) {
						console.log("Inspecting:".blue, file);
						var currentFilePath = path.join(basePath, file);
						var fileObject = generateFileObject(currentFilePath);
						var instanceObject = fileObject.instance;
						var tableObject = fileObject.folder;
						var urlObj = {
							pathname: "/" + tableObject.table + ".do",
							query: {
								sysparm_action: "getRecords",
								sysparm_query: tableObject.key + "=" + fileObject.identifier
							}
						};
						urlObj.query[instanceObject.json] = "";
						var restClient = restify.createJsonClient({
							url: instanceObject.host
						});
						restClient.basicAuth(fileObject.user, fileObject.pass);
						restClient.get(url.format(urlObj), function(err, req, res, obj) {
							restClient.close();
							var currentRecord = obj.records[0];
							var instanceVer = currentRecord[tableObject.fields[fileObject.extension]];
							var fileVer = fs.readFileSync(currentFilePath, 'utf8');
							var differences = diff.diffLines(instanceVer, fileVer);
							var differenceMessage = "\n";
							var differenceCount = 0;
							for (var j = 0; j != differences.length; j++) {
								var difference = differences[j];
								var diffVal = difference.value.trim();
								if (diffVal != "\r" && diffVal != "\n" && diffVal !== "") {
									if (difference.added) {
										differenceCount++;
										differenceMessage += "Local Version: " + difference.value.green;
									}
									if (difference.removed) {
										differenceCount++;
										differenceMessage += "SN Version:" + difference.value.red;
									}
									if (!difference.added && !difference.removed) {
										differenceMessage += "\n" + difference.value.grey;
									}
								}
							}
							if (differenceCount !== 0) {
								console.log(differenceMessage);
							}
							fileCallback();
						});

					},
					function(err) {
						console.log("Inspection Complete".blue);
						showStartPrompt();
					}
				);
			}
		}
	}
};

function getSeriesArray(instanceName, tableName) {
	var instanceArray = instanceName ? [instanceName] : Object.keys(configData.instances).sort();
	var tableArray = tableName ? [tableName] : Object.keys(configData.folders).sort();
	var seriesArray = [];
	for (var i = 0; i != instanceArray.length; i++) {
		var tempObject = {
			"instance": instanceArray[i],
			"folders": tableArray
		};
		seriesArray.push(tempObject);
	}
	return seriesArray;
}

function iterateInstanceObject(iterateObject, callback) {
	var instance = iterateObject.instance;
	var folders = iterateObject.folders;
	var rootFolder = configData.root;
	createFolder(path.join(rootFolder, instance));
	async.eachSeries(
		folders,
		function(folder, folderCallback) {
			createFolder(path.join(rootFolder, instance, folder));
			getTableData(instance, folder, folderCallback);
		},
		function(err) {
			configData.instances[instance].last_synced = moment().format("YYYY-MM-DD HH:mm:ss");
			console.log("File Sync Complete:".blue, instance);
			callback();
		}
	);
}

function saveFile(data, filePath) {
	fs.writeFileSync(filePath, data);
	return console.log(moment().format("YYYY-MM-DD HH:mm:ss").bold.grey, 'Saved:'.green, filePath);
}

function onFileEvent(fileEvent, filePath) {
	console.log("Event:".blue, fileEvent.cyan, filePath);
	var fileObject = generateFileObject(filePath);
	if (fileEvent == "unlink") {
		return;
	}
	if (fileObject.is_settings && fileEvent == "add") {
		return;
	}
	var action = fileEvent == "add" ? "insert" : "update";
	upsertFileData(fileObject, action);
}

function generateFileObject(filePath) {
	var rootFolder = configData.root;
	var fileDetails = filePath.split(rootFolder)[1].split("/");
	var instanceObject = configData.instances[fileDetails[0]];
	var folderObject = configData.folders[fileDetails[1]];
	var fileDataString = fs.readFileSync(filePath, 'utf8');
	var auth = new Buffer(instanceObject.auth, 'base64').toString();
	var parts = auth.split(':');
	var user = parts[0];
	var pass = parts[1];
	var fileDataObject = {};
	var isSettings = false;
	var isUiPage = false;
	var identifier = "";
	var fullFileName = fileDetails[2];
	var fileDirectory = path.join(rootFolder, fileDetails[0], fileDetails[1]);

	for (var key in folderObject.fields) {
		if (filePath.indexOf(key) != -1) {
			if (fileDetails[3]) {
				isUiPage = true;
				fullFileName = fileDetails[3];
				fileDirectory = path.join(rootFolder, fileDetails[0], fileDetails[1], fileDetails[2]);
			}
			fileDataObject[folderObject.fields[key]] = fileDataString;
			identifier = fullFileName.split("." + key)[0];
		}
	}
	if (fullFileName.indexOf(".settings.json") != -1) {
		fileDataObject = JSON.parse(fileDataString);
		isSettings = true;
		identifier = fullFileName.split(".settings.json")[0];
		isUiPage = false;
	}

	return {
		root: rootFolder,
		file_path: filePath,
		file_details_array: fileDetails,
		instance: instanceObject,
		folder: configData.folders[fileDetails[1]],
		file_data_string: fileDataString,
		file_data_object: fileDataObject,
		identifier: identifier.replace("___", "/"),
		extension: fullFileName.split(identifier + ".")[1],
		full_file_name: fullFileName,
		file_directory: fileDirectory,
		user: user,
		pass: pass,
		is_settings: isSettings,
		is_ui_page: isUiPage
	};
}

function upsertFileData(fileObject, action) {
	var instanceObject = fileObject.instance;
	var tableObject = fileObject.folder;
	var urlObj = {
		pathname: "/" + tableObject.table + ".do",
		query: {
			sysparm_action: action
		}
	};
	if (action == "update") {
		urlObj.query.sysparm_query = tableObject.key + "=" + fileObject.identifier.replace("___", "/");
	}
	if (action == "insert") {
		if (fileObject.is_settings) {
			return;
		}
		fileObject.file_data_object[tableObject.key] = fileObject.identifier;
	}

	urlObj.query[instanceObject.json] = "";
	var client = restify.createJsonClient({
		url: instanceObject.host
	});
	client.basicAuth(fileObject.user, fileObject.pass);
	client.post(url.format(urlObj), fileObject.file_data_object, function(err, req, res) {
		var responseBody = JSON.parse(res.body);
		if (res.statusCode == 200) {
			if (responseBody.records.length === 0 && action == "update" && !fileObject.is_settings) {
				upsertFileData(fileObject, "insert");
			} else {
				console.log(moment().format("YYYY-MM-DD HH:mm:ss").bold.grey, action.toUpperCase().green + ":".green, fileObject.full_file_name);
				if (!fileObject.is_settings && !fileObject.is_ui_page) {
					createSettingsFile(responseBody.records[0], fileObject);
				}
			}
		} else {
			console.log(moment().format("YYYY-MM-DD HH:mm:ss").bold.grey, "Error:".red, getErrorDefinition(res.statusCode).red, fileObject.full_file_name);
		}
		client.close();
		rl.prompt();
	});
}

function createSettingsFile(currentRecord, fileObject) {
	var pathName = path.join(fileObject.file_directory, fileObject.identifier + ".settings.json");

	var settings = {};
	for (var key in fileObject.folder.fields) {
		for (var fieldKey in currentRecord) {
			if (fieldKey != fileObject.folder.fields[key] && fieldKey != fileObject.folder.key) {
				settings[fieldKey] = currentRecord[fieldKey];
			}
		}
	}
	var settingsString = JSON.stringify(settings, null, 4);
	saveFile(settingsString, pathName);
}

function getTableData(instance, folder, callback) {
	var rootFolder = configData.root;
	var instanceObject = configData.instances[instance];
	var tableObject = configData.folders[folder];
	var auth = new Buffer(instanceObject.auth, 'base64').toString();
	var parts = auth.split(':');
	var user = parts[0];
	var pass = parts[1];
	var lastSynced = instanceObject.last_synced.split(' ');
	var urlObj = {
		pathname: "/" + tableObject.table + ".do",
		query: {
			sysparm_action: "getRecords",
			sysparm_query: "sys_updated_on>javascript:gs.dateGenerate('" + lastSynced[0] + "','" + lastSynced[1] + "')^sys_created_by=" + user + "^ORsys_updated_by=" + user,
		}
	};
	urlObj.query[instanceObject.json] = "";
	var options = {
		"path": url.format(urlObj),
		"retry": {
			"retries": 0
		},
		"agent": false
	};
	var pathName = path.join(rootFolder, instance, folder);
	var client = restify.createJsonClient({
		url: instanceObject.host
	});
	client.basicAuth(user, pass);
	client.get(options, function(err, req, res, obj) {
		if (obj.records) {
			obj.records.forEach(function(currentRecord) {
				for (var key in tableObject.fields) {
					var fileName = currentRecord[tableObject.key].replace(/\//g, "___");
					var dataValue = currentRecord[tableObject.fields[key]];

					if (dataValue !== "" && fileName !== "") {
						if (folder != "ui_pages") {
							saveFile(dataValue, path.join(pathName, fileName + "." + key));
							var settings = {};
							for (var fieldKey in currentRecord) {
								if (fieldKey != tableObject.fields[key]) {
									settings[fieldKey] = currentRecord[fieldKey];
								}
							}
							var settingsPathName = path.join(pathName, fileName + ".settings.json");
							saveFile(JSON.stringify(settings, null, 4), settingsPathName);
						} else {
							var uiPageFolder = path.join(pathName, fileName);
							createFolder(uiPageFolder);
							saveFile(dataValue, path.join(uiPageFolder, fileName + "." + key));
						}
					}
				}
			});
			client.close();
			callback();
		}
	});
}

function sendRestMessage(instance, callback) {
	var instanceObject = configData.instances[instance];
	var auth = new Buffer(instanceObject.auth, 'base64').toString();
	var parts = auth.split(':');
	var user = parts[0];
	var pass = parts[1];
	var urlObj = {
		pathname: '/sys_user.do',
		query: {
			sysparm_action: "getRecords",
			sysparm_query: "user_name=" + user
		}
	};
	urlObj.query[instanceObject.json] = "";
	var options = {
		"path": url.format(urlObj),
		"retry": {
			"retries": 0
		},
		"connectTimeout": 1000,
		"agent": false
	};
	var client = restify.createJsonClient({
		url: instanceObject.host
	});
	client.basicAuth(user, pass);
	client.get(options, function(err, req, res, obj) {
		var message = instance + "\nStatus Code: " + res.statusCode;
		if (res.statusCode == 200) {
			message = "Success: ".green + message;
		} else {
			message = "Error: ".red + message + "\nMessage: " + getErrorDefinition(res.statusCode).red + "\nPath: " + options.path;
		}
		console.log(message + "\n");
		client.close();
		callback();
	});
}

function createConfigFile(rootDirectory) {
	configData = {
		"root": rootDirectory,
		"instances": {},
		"folders": {
			"business_rules": createFolderConfig("sys_script", "name", {
				"js": "script"
			}),
			"client_scripts": createFolderConfig("sys_script_client", "name", {
				"js": "script"
			}),
			"processors": createFolderConfig("sys_processor", "name", {
				"js": "script"
			}),
			"script_actions": createFolderConfig("sysevent_script_action", "name", {
				"js": "script"
			}),
			"script_includes": createFolderConfig("sys_script_include", "name", {
				"js": "script"
			}),
			"style_sheets": createFolderConfig("content_css", "name", {
				"css": "style"
			}),
			"ui_actions": createFolderConfig("sys_ui_action", "name", {
				"js": "script"
			}),
			"ui_macros": createFolderConfig("sys_ui_macro", "name", {
				"xhtml": "xml"
			}),
			"ui_scripts": createFolderConfig("sys_ui_script", "name", {
				"js": "script"
			}),
			"ui_pages": createFolderConfig("sys_ui_page", "name", {
				"xhtml": "html",
				"client.js": "client_script",
				"server.js": "processing_script"
			})
		}
	};
}

function createFolder(pathName) {
	var folderCreated = fs.existsSync(pathName);
	if (!folderCreated) {
		fs.mkdirSync(pathName);
		console.log("Folder Created:".green, pathName);
		return true;
	}
	console.log("Folder Exist:".red, pathName);
	return false;
}

function encodeCredentials(username, password) {
	var auth = new Buffer(username + ':' + password).toString('base64');
	return auth;
}

function createFolderConfig(table, key, fields) {
	return {
		"table": table,
		"key": key,
		"fields": fields
	};
}

function getErrorDefinition(statusCode) {
	switch (statusCode) {
		case 401:
			return "Authorization Error";
		case 302:
			return "Check that JSON plugin is activated and correct version of JSON is set";
		default:
			return "";
	}
}

function inputCompleter(line) {
	var hits = completions.filter(function(c) {
		return c.indexOf(line) === 0;
	});
	return [hits.length ? hits : completions, line];
}

function showStartPrompt() {
	var promptMessage = DEFAULTPROMPT;
	completions = DEFAULTCOMPLETIONS;
	promptData = [];
	if (Object.keys(configData).length === 0) {
		var fileExists = fs.existsSync(CONFIG_FILE);
		if (fileExists) {
			configData = JSON.parse(fs.readFileSync(CONFIG_FILE));
		} else {
			promptData.push("install");
			promptMessage = "What is the root directory, were the files will be stored? ";
		}
	} else {
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 4));
	}
	rl.setPrompt(promptMessage);
	rl.prompt();
}

rl.on("line", function(action) {
	rl.pause();
	var promptSelection = action;
	if (promptData[0]) {
		promptSelection = promptData[0];
	}
	promptData.push(action);
	var promptDataLength = promptData.length;

	switch (promptSelection) {
		case "install":
			if (promptDataLength == 2) {
				appGet.installFileSync(promptData[1]);
			} else {
				rl.setPrompt("What is the root directory, were the files will be stored? ");
				rl.prompt();
			}
			break;
		case "create":
			switch (promptDataLength) {
				case 7:
					if (promptData[6] != "JSON" && promptData[6] != "JSONv2") {
						console.log(promptData.pop().red.underline.bold, "is not valid please use JSON or JSONv2");
						rl.prompt();
					} else {
						appGet.upsertInstanceInfo(promptData[1], promptData[2], promptData[3], promptData[4], promptData[5], promptData[6]);
					}
					break;
				case 6:
					if (promptData[5] != "true" && promptData[5] != "false") {
						console.log(promptData.pop().red.underline.bold, "is not valid please use true or false");
						rl.prompt();
					} else {
						rl.setPrompt("JSON version: ");
						completions = "JSON JSONv2".split(" ");
						rl.prompt();
					}
					break;
				case 5:
					rl.setPrompt("Read-Only: ");
					completions = "false true".split(" ");
					rl.prompt();
					break;
				case 4:
					rl.setPrompt("Password: ");
					rl.prompt();
					break;
				case 3:
					rl.setPrompt("Username: ");
					rl.prompt();
					break;
				case 2:
					rl.setPrompt("Instance name: ");
					rl.prompt();
					break;
				default:
					rl.setPrompt("Folder name: ");
					rl.prompt();
					break;
			}
			break;
		case "setup-folders":
			if (promptDataLength == 2) {
				appGet.upsertFolderStructure(promptData[1]);
			} else {
				rl.setPrompt("Instance folder name: ");
				completions = Object.keys(configData.instances).sort();
				rl.prompt();
			}
			break;
		case "add-table":
			//MAKE A REST CALL TO GET OPTIONS
			switch (promptDataLength) {
				case 6:
					appGet.upsertTableInfo(promptData[1], promptData[2], promptData[3], promptData[4], promptData[5]);
					break;
				case 5:
					rl.setPrompt("File type or extension: ");
					rl.prompt();
					break;
				case 4:
					rl.setPrompt("Unique identifier: ");
					rl.prompt();
					break;
				case 3:
					rl.setPrompt("Source field: ");
					rl.prompt();
					break;
				case 2:
					rl.setPrompt("SN table name: ");
					rl.prompt();
					break;
				default:
					rl.setPrompt("Folder name: ");
					rl.prompt();
					break;
			}
			break;
		case "test-connection":
			if (promptDataLength == 2) {
				appGet.testConnection(promptData[1]);
			} else {
				rl.setPrompt("Instance folder name: ");
				completions = Object.keys(configData.instances).sort();
				rl.prompt();
			}
			break;
		case "sync-files":
			switch (promptDataLength) {
				case 3:
					appGet.grabInstanceFiles(promptData[1], promptData[2]);
					break;
				case 2:
					rl.setPrompt("Table folder name: ");
					completions = Object.keys(configData.folders).sort();
					rl.prompt();
					break;
				default:
					rl.setPrompt("Instance folder name: ");
					completions = Object.keys(configData.instances).sort();
					rl.prompt();
					break;
			}
			break;
		case "list-instances":
			var outputMessage = "";
			for (var key in configData.instances) {
				outputMessage += "Folder: ".green + key + "\n";
				outputMessage += prettyStringify(currentFolder) + "\n";
			}
			console.log(outputMessage);
			showStartPrompt();
			break;
		case "list-tables":
			var outputMessage = "";
			for (var key in configData.folders) {
				var currentFolder = configData.folders[key];
				outputMessage += "Folder: ".green + key + "\n";
				outputMessage += prettyStringify(currentFolder) + "\n";
			}
			console.log(outputMessage);
			showStartPrompt();
			break;
		case "remove-instance":
			if (promptDataLength == 2) {
				delete configData.instances[promptData[1]];
				showStartPrompt();
			} else {
				rl.setPrompt("Instance folder name: ");
				completions = Object.keys(configData.instances).sort();
				rl.prompt();
			}
			break;
		case "remove-table":
			if (promptDataLength == 2) {
				delete configData.folders[promptData[1]];
				showStartPrompt();
			} else {
				rl.setPrompt("Table folder name: ");
				completions = Object.keys(configData.folders).sort();
				rl.prompt();
			}
			break;
		case "remove-field":
			switch (promptDataLength) {
				case 3:
					delete configData.folders[promptData[1]].fields[promptData[2]];
					showStartPrompt();
					break;
				case 2:
					rl.setPrompt("Field name: ");
					completions = Object.keys(configData.folders[promptData[1]].fields).sort();
					rl.prompt();
					break;
				default:
					rl.setPrompt("Table folder name: ");
					completions = Object.keys(configData.folders).sort();
					rl.prompt();
					break;
			}
			break;
		case "inspect":
			switch (promptDataLength) {
				case 4:
					appGet.inspectFile(promptData[1], promptData[2], promptData[3]);
					break;
				case 3:
					var fileList = fs.readdirSync(path.join(configData.root, promptData[1], promptData[2]));
					completions = [];
					for (var i = 0; i != fileList.length; i++) {
						if (fileList[i].indexOf(".settings.json") == -1) {
							completions.push(fileList[i]);
						}
					}
					rl.setPrompt("File name: ");
					completions = completions.sort();
					rl.prompt();
					break;
				case 2:
					rl.setPrompt("Table folder name: ");
					completions = Object.keys(configData.folders).sort();
					rl.prompt();
					break;
				default:
					rl.setPrompt("Instance folder name: ");
					completions = Object.keys(configData.instances).sort();
					rl.prompt();
					break;
			}
			break;
		case "watch":
			completions = "exit stop".split(' ');
			appGet.watchFolders();
			break;
		case "exit":
			rl.close();
			break;
		case "stop":
			appGet.stopWatch();
			showStartPrompt();
			break;
		default:
			showStartPrompt();
			break;
	}
}).on("close", function() {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 4));
	console.log("GoodBye");
	process.exit(0);
});

showStartPrompt();