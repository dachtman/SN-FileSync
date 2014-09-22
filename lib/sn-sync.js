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

function saveFile(filePath, data) {
	fs.writeFileSync(filePath, data);
	sync_logger.logTitle( "File Saved" );
	sync_logger.logSuccess( filePath );
}

function addFolder ( pathname ){
	if ( !fs.existsSync( pathname ) ) {
		fs.mkdirSync( pathname );
		sync_logger.logTitle( "Directory Created" );
		sync_logger.logSuccess( pathname );
	}
	return false;
}

function syncFiles( err, req, res, obj ){
	console.log(obj)
	if(obj.records){
		var tableObject = getTableObject( req.path );
		var instanceObject = getInstanceObject( req.Host );
		var basePath = path.join( instanceObject.path, tableObject.name );
		var records = obj.records;
		addFolder( instanceObject.path );
		addFolder( basePath );
		for(var i = 0; i != records.length; i++){
			var currentRecord = records[i];
			for( var key in tableObject.fields ){
				saveFile(
					path.join(
						basePath,
						currentRecord[tableObject.key] + "." + tableObject.fields[key]
					),
					currentRecord[key]
				);
			}
		}
	}else{
		sync_logger.logFailure( "No Records Retrieved" );
	}
}

function upsertRecord (fileInfo){
	var instanceObject = CONFIG_OBJECT.instances[ fileInfo.instanceName ];
	var tableObject = CONFIG_OBJECT.tables[ fileInfo.folderName ];
	var decodedCreds = decodeCredentials( instanceObject.auth );
	var restClient = restify.createJsonClient({
		url: instanceObject.host,
		retry:false,
		connectTimeout:1000
	});
	var urlObj = {
		pathname: "/" + tableObject.table + ".do",
		query: {
			sysparm_action: fileInfo.action
		}
	};
	var fieldName = getField( fileInfo.extension, tableObject.fields );
	var dataObject = {};
	dataObject[fieldName] = fileInfo.data;
	dataObject[tableObject.key] = fileInfo.fileName;

	urlObj.query[instanceObject.json] = "";
	if( fileInfo.action == "update" ){
		urlObj.query.sysparm_query = tableObject.key + "=" + fileInfo.fileName;
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
			sysparm_query: sysparmQuery || "sys_updated_on=" + instanceObject.last_synced
		}
	};
	urlObj.query[instanceObject.json] = "";
	restClient.basicAuth( decodedCreds.username, decodedCreds.password );
	sendRestMessage( restClient, "get", url.format(urlObj), false, syncFiles );
	return config.updateInstanceFolder( instanceName, "last_synced", moment().format("YYYY-MM-DD HH:mm:ss") );
}


exports.getRecords = function( instanceName, folderName, sysparmQuery ){
	return getRecords(instanceName, folderName, sysparmQuery);
};

exports.upsertRecord = function ( fileInfo ){
	upsertRecord(fileInfo);
};