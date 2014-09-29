//READING WRITING TO SN
// Requires
var config = require("./configurator");
var restify = require("restify");
var fs = require("graceful-fs");
var url = require('url');
var sync_logger = require("./sync-logger");
var async = require("async");
var querystring = require("querystring");
var path = require("path");
var moment = require("moment");
var CONFIG_OBJECT = config.retrieveConfig();

function getTableObject(requestPath){
	var tables = CONFIG_OBJECT.tables;
	var tableName = requestPath.split(".do")[0];
	for(var key in tables){
		if(tables[key].table == tableName){
			return tables[key];
		}
	}
	return false;
}

function getInstanceObject(requestHost){
	var instances = CONFIG_OBJECT.instances;
	for(var key in instances){
		if(instances[key].host == requestHost){
			return instances[key];
		}
	}
	return false;
}

function getSysparmAction(requestPath){
	var queryObject = querystring.parse(requestPath);
	return queryObject.sysparm_action;
}

function getField( extension, fields ){
	for(var key in fields){
		if(fields[key] == extension){
			return key;
		}
	}
}

function decodeCredentials(auth){
	var credentials = new Buffer(auth, 'base64').toString();
	credentialsArray = credentials.split(":");
	return {
		username : credentialsArray[0],
		password : credentialsArray[1]
	}
}

function sendRestMessage(restClient, method, urlString, data, restCallBack){
	if(data){
		restClient[method](urlString,data,restCallBack);
	} else {
		restClient[method](urlString,restCallBack);
	}
	restClient.close();
}

function saveFile(filePath, data) {
	try{
		fs.writeFileSync(filePath, data);
		sync_logger.logTitle( "File Saved" );
		sync_logger.logSuccess( filePath );	
	}
	catch (err){
		sync_logger.logFailure(err);
	}
	
}

function addFolder ( pathname ){
	if ( !fs.existsSync( pathname ) ) {
		fs.mkdirSync( pathname );
		sync_logger.logTitle( "Directory Created" );
		sync_logger.logSuccess( pathname );
	}
	return false;
}

function createSettingsFile(key, record, tableObjectKey, fileName, basePath){
	var settingsObject = {};
	for(var recordKey in record){
		if(recordKey != key && recordKey != tableObjectKey && recordKey.indexOf("sys_") != 0){
			settingsObject[recordKey] = record[recordKey];
		}
	}
	saveFile(
		path.join(basePath,fileName+".settings.json"),
		JSON.stringify(settingsObject,undefined,"\t")
	);
}

function upsertFile(err, req, res){
	if(res.statusCode == 200){
		var responseBody = JSON.parse(res.body);
		var instanceObject = getInstanceObject( "https://" + req._headers.host );
		var tableObject = getTableObject( req.path.substring(1) );
		var queryObject = url.parse( req.path, true ).query;
		var action = queryObject.sysparm_action;

		if(responseBody.records.length === 0 && action == "update"){
			var fileName = queryObject.sysparm_query.split("=")[1];
			for(var currentField in tableObject.fields){
				var currentExtension = tableObject.fields[currentField];
				var currentPath = path.join( instanceObject.path, tableObject.name, fileName + "." + currentExtension );
				if(fs.existsSync( currentPath ) ){
					upsertRecord({
						fileName : fileName,
						folderName : tableObject.name,
						instanceName : instanceObject.name,
						extension : currentExtension,
						data : fs.readFileSync(currentPath, "utf8"),
						action : "insert"
					});
				}
			}
		}else{
			sync_logger.logSuccess( "Record " + action );	
		}
		
	}
	else {
		sync_logger.logFailure( "No Records " + action );	
	}
}

function syncFiles( err, req, res, obj ){
	if(res.statusCode == 200){
		if(obj.records.length != 0){
			var instanceObject = getInstanceObject( "https://" + req._headers.host );
			var tableObject = getTableObject( req.path.substring(1) );

			var basePath = path.join( instanceObject.path, tableObject.name );
			var records = obj.records;
			addFolder( instanceObject.path );
			addFolder( basePath );
			async.eachSeries(
				records,
				function(record,callback){
					for( var key in tableObject.fields ){
						var currentRegex = new RegExp(path.sep,"g");
						var fileName = record[tableObject.key].replace(currentRegex,"___");
						saveFile(
							path.join(
								basePath,
								fileName + "." + tableObject.fields[key]
							),
							record[key]
						);
						if(tableObject.table != "sys_ui_page"){
							createSettingsFile(key, record, tableObject.key, fileName, basePath)
						}
					}
					callback();
				}, 
				function(err){
					if(err){
						sync_logger.logFailure(err);
					}
				}
			);
		}
	}else{
		sync_logger.logFailure( "No Records Retrieved, Code: " + res.statusCode);
	}
}

function upsertRecord (fileInfo){
	var instanceObject = CONFIG_OBJECT.instances[ fileInfo.instanceName ];
	var tableObject = CONFIG_OBJECT.tables[ fileInfo.folderName ];
	if(!instanceObject && !tableObject){
		return;
	}
	var decodedCreds = decodeCredentials( instanceObject.auth );
	var restClient = restify.createJsonClient({
		url: instanceObject.host,
		retry:false,
		connectTimeout:1000,
		agent:false
	});
	var urlObj = {
		pathname: "/" + tableObject.table + ".do",
		query: {
			sysparm_action: fileInfo.action
		}

	};
	var fieldName = getField( fileInfo.extension, tableObject.fields );
	var fileName = fileInfo.fileName.replace(/___/g,path.sep)
	var dataObject = {};
	if(fileInfo.extension == "settings.json"){
		dataObject = JSON.parse(fileInfo.data);
	}else{
		dataObject[fieldName] = fileInfo.data;
		dataObject[tableObject.key] = fileName;
	}

	urlObj.query[instanceObject.json] = "";
	if( fileInfo.action == "update" ){
		urlObj.query.sysparm_query = tableObject.key + "=" + fileName;
	}
	restClient.basicAuth( decodedCreds.username, decodedCreds.password );
	sendRestMessage( restClient, "post", url.format(urlObj), dataObject, upsertFile );
}

function getRecords(instanceName, folderName, sysparmQuery){
	var instanceObject = CONFIG_OBJECT.instances[instanceName];
	var tableObject = CONFIG_OBJECT.tables[folderName];
	var decodedCreds = decodeCredentials(instanceObject.auth);
	var restClient = restify.createJsonClient({
		url: instanceObject.host,
		agent:false,
		retry:false,
		connectTimeout:1000,
	});
	var urlObj = {
		pathname: "/" + tableObject.table + ".do",
		query: {
			sysparm_action: "getRecords",
			sysparm_query: sysparmQuery || "sys_updated_on>" + instanceObject.last_synced
		}
	};
	urlObj.query[instanceObject.json] = "";
	restClient.basicAuth( decodedCreds.username, decodedCreds.password );
	sendRestMessage( restClient, "get", url.format(urlObj), false, syncFiles );
	config.updateInstanceFolder( instanceName, "last_synced", moment().format("YYYY-MM-DD HH:mm:ss") );
}


exports.getRecords = function( instanceName, folderName, sysparmQuery){
	getRecords(instanceName, folderName, sysparmQuery);
};

exports.upsertRecord = function ( fileInfo ){
	upsertRecord(fileInfo);
};