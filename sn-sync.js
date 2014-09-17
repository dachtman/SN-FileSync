//READING WRITING TO SN
// Requires
var config = require("./config");
var restify = require("restify");

var configData = config.retrieveConfig();

function getInstance(instanceName){
	if(instanceName){
		if(configData.instances[instanceName]){
			return configData.instances[instanceName]
		}	
	} else {
		return configData.instances;
	}
}

function getTable(tableName){
	if(tableName){
		if(configData.tables[tableName]){
			return configData.tables[tableName]
		}	
	} else {
		return configData.tables;
	}	
}

exports.retrieveInstances = function(instanceName){
	return getInstance(instanceName);
};

exports.retrieveTable = function(tableName){
	return getTable(tableName);
};