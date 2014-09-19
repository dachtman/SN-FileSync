var monitor = require("./monitor");
var sn_sync = require("./sn-sync");
var config = require("./configurator");
var sync_logger = require("./sync-logger");
var readline = require('readline');
var CONFIG_OBJECT = config.retrieveConfig();
var PROMPTDATA = [];
var DEFAULTPROMPT = "What action would you like to perform? ";
var DEFAULTCOMPLETIONS = "install create setup-folders add-table test-connection sync-files list-instances list-tables remove-instance remove-table remove-field inspect watch exit".split(" ").sort();
var COMPLETIONS = DEFAULTCOMPLETIONS;
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: inputCompleter
});

function inputCompleter(line){
	var returnArray = [line];
	var completionHits = COMPLETIONS.filter(
		function(input){
			return input.indexOf(line) == 0;
		});
	if(completionHits.length){
		returnArray.unshift(completionHits);
	}else{
		returnArray.unshift(COMPLETIONS);
	}
}

function getInstance(instanceName){
	if(instanceName){
		if(CONFIG_OBJECT.instances[instanceName]){
			return CONFIG_OBJECT.instances[instanceName]
		}	
	} else {
		return CONFIG_OBJECT.instances;
	}
}

function getTable(tableName){
	if(tableName){
		if(CONFIG_OBJECT.tables[tableName]){
			return CONFIG_OBJECT.tables[tableName]
		}	
	} else {
		return CONFIG_OBJECT.tables;
	}	
}

/*exports.retrieveInstances = function(instanceName){
	return getInstance(instanceName);
};

exports.retrieveTable = function(tableName){
	return getTable(tableName);
};*/

