//Write to CONFIG FILE
var fs = require("graceful-fs");
var path = require("path");

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

function updateConfig( key, value ){
	var currentConfig = JSON.parse( readConfig() );
	currentConfig[key] = value;
	saveConfig( JSON.stringify( currentConfig ) );
	return currentConfig;
}

exports.createTable = function( folderName, tableName, key, fields ){
	return updateConfig(
		folderName,
		{
			"table":tableName,
			"key":key || "name",
			"fields":fields || {"js":"script"}
		}
	);
};

exports.createInstance = function( folderName, instanceName, auth, jsonVer, readOnly ){
	return updateConfig(
		folderName,
		{
			"host":"https://" + instanceName + "service-now.com",
			"auth":auth,
			"last_synced":"1969-12-31 23:59:59",
			"JSON":jsonVer || "JSON",
			"read_only":readOnly || "false"
		}
	);
};

exports.updateInstanceOrTable = function (folderName, key, value){
	var currentConfig = JSON.parse( readConfig() );
	currentConfig[folderName][key] = value;
	saveConfig( JSON.stringify( currentConfig ) );

	return currentConfig;
};

exports.upsertRoot = function( rootDirectory ){
	return updateConfig( "root", rootDirectory );
};

exports.retrieveConfig = function(){
	return JSON.parse( readConfig() );
};

exports.storeConfig = function(data){
	saveConfig( JSON.stringify( data ) );
}