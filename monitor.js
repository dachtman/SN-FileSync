var config = require("./configurator");
var fs = require("graceful-fs");
var chokidar = require("chokidar");
var path = require("path");
var sn_sync = require("./sn-sync");
var sync_logger = require("./sync-logger");

var CONFIG_OBJECT = config.retrieveConfig();
var chokidarOptions = {
	"persistent":"true",
	"ignorePermissionErrors":"false",
	"ignoreInitial":"true",
	"interval":"100"
};

function addFile ( pathname ){
	var fileInfo = getFileInfo( pathname );
	fileInfo.action = "insert";
	sn_sync.upsertRecord( fileInfo );
	sync_logger.logTitle( "File Created" );
	sync_logger.logSuccess( pathname );
}

function changeFile ( pathname ){
	var fileInfo = getFileInfo( pathname );
	fileInfo.action = "update";
	sn_sync.upsertRecord( fileInfo );
	sync_logger.logTitle( "File Changed" );
	sync_logger.logSuccess( pathname );
}

function getFileInfo( pathname ){
	var extension = path.extname( pathname );
	var baseDirectory = path.dirname( pathname );

	return {
		fileName : path.basename( pathname, extension ),
		folderName : path.basename( baseDirectory ),
		instanceName : path.basename( path.dirname( baseDirectory ) ),
		extension : extension.substr( 1 ),
		data : fs.readFileSync( pathname, "utf8")
	};
}

function fileError( error ){
	sync_logger.logFailure( pathname );	
}

module.exports = function( pathname ){
	this.fileWatcher = chokidar.watch( pathname || __dirname , chokidarOptions );
	this.fileWatcher.on( "add", addFile );
	this.fileWatcher.on( "change", changeFile );
	this.fileWatcher.on( "error" , fileError );

	this.closeMonitor = function(){
		this.fileWatcher.close();
	};

	this.addPathToWatcher = function( pathname ){
		this.fileWatcher.add( pathname );
	};
};

