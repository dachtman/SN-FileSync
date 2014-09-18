var config = require("./configurator");
var fs = require("graceful-fs");
var chokidar = require("chokidar");
var sn_sync = require("./sn-sync");
var sync_logger = require("./sync-logger");

var CONFIG_OBJECT = config.retrieveConfig();
var chokidarOptions = {
	"persistent":"true",
	"ignorePermissionErrors":"false",
	"ignoreInitial":"true",
	"interval":"100"
};

function addFolder ( pathName ){
	if ( !fs.existsSync( pathName ) ) {
		fs.mkdirSync( pathName );
		sync_logger.logTitle( "Directory Created" );
		sync_logger.logSuccess( pathName );
	}
	return false;
}

function addFile ( pathName ){
	sync_logger.logTitle( "File Created" );
	sync_logger.logSuccess( pathName );
}

function changeFile ( pathName ){
	sync_logger.logTitle( "File Changed" );
	sync_logger.logSuccess( pathName );
}

function fileError( error ){
	sync_logger.logFailure( pathname );	
}

module.exports = function( pathName ){
	this.fileWatcher = chokidar.watch( pathName || __dirname , chokidarOptions );
	this.fileWatcher.on( "add", addFile );
	this.fileWatcher.on( "addDir", addFolder );
	this.fileWatcher.on( "change", changeFile );
	this.fileWatcher.on( "error" , fileError );

	this.closeMonitor = function(){
		this.fileWatcher.close();
	};

	this.addPathToWatcher = function( pathName ){
		this.fileWatcher.add( pathname );
	};
};

