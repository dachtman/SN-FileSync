var monitor = require("./monitor");
var sn_sync = require("./sn-sync");
var config = require("./configurator");
var CONFIG_OBJECT = config.retrieveConfig();

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

