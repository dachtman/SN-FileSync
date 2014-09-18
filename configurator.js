//Write to CONFIG FILE
var fs = require("graceful-fs");
var path = require("path");
var sync_logger = require("./sync-logger");

var CONFIG_FILE = path.join(__dirname, "file_sync.config.json");

function readConfig (){
	if( fs.existsSync( CONFIG_FILE ) ){
		return fs.readFileSync(CONFIG_FILE,"utf-8");	
	} else {
		return "{}";
	}
}

function saveConfig (data){
	fs.writeFileSync(CONFIG_FILE, data);
}

function encodeCredentials( username, password ) {
	var auth = new Buffer(username + ':' + password).toString('base64');
	return auth;
}

function decodeCredentials(auth){
	var credentials = new Buffer(instanceObject.auth, 'base64').toString();
	credentialsArray = credentials.split(":");
	return {
		username : credentialsArray[0],
		password : credentialsArray[1]
	}
}

function updateConfig( parentName, key, value ){
	var currentConfig = JSON.parse( readConfig() );
	currentConfig[parentName][key] = value;
	saveConfig( JSON.stringify( currentConfig ) );
	return currentConfig;
}

exports.createTable = function( folderName, tableName, key, fields ){
	return updateConfig(
		"tables",
		folderName,
		{
			"name":folderName,
			"table":tableName,
			"key":key || "name",
			"fields":fields || {"script":"js"}
		}
	);
};

exports.createInstance = function( folderName, instanceName, username, password, jsonVer, readOnly ){
	return updateConfig(
		"instances",
		folderName,
		{
			"path":path.join(__dirname,folderName),
			"host":"https://" + instanceName + "service-now.com",
			"auth":encodeCredentials( username, password ),
			"last_synced":"1969-12-31 23:59:59",
			"JSON":jsonVer || "JSON",
			"read_only":readOnly || "false"
		}
	);
};

exports.updateInstanceFolder = function( folderName, key, value ){
	var currentConfig = JSON.parse( readConfig() );
	var instanceObject = currentConfig.instances[folderName];
	if(key == "password" || key == "username"){
		var decodedCreds = decodeCredentials( instanceObject.auth );
		decodedCreds[key] = value;
		value = encodeCredentials( decodedCreds.username, decodedCreds.password );
		key = "auth";
	}
	instanceObject[folderName][key] = value;
	updateConfig(
		"instances",
		folderName,
		instanceObject
	);

};

exports.updateTableFolder = function( folderName, key, value ){
	var currentConfig = JSON.parse( readConfig() );
	var tableObject = currentConfig.tables[folderName];
	tableObject[key] = value;
	updateConfig(
		"tables",
		folderName,
		tableObject
	);
};

/*exports.upsertRoot = function( rootDirectory ){
	return updateConfig( "root", rootDirectory );
};*/

exports.retrieveConfig = function(){
	return JSON.parse( readConfig() );
};

exports.storeConfig = function(data){
	saveConfig( JSON.stringify( data ) );
}

