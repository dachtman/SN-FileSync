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
	return fs.writeFileSync(CONFIG_FILE, data);
}

exports.updateConfig = function ( key, value ){
	var currentConfig = JSON.parse( readConfig() );
	currentConfig[key] = value;
	saveConfig( JSON.stringify( currentConfig ) );

	return "File Updated";
}
