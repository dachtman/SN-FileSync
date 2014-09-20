var monitor = require("./monitor");
var sn_sync = require("./sn-sync");
var config = require("./configurator");
var sync_logger = require("./sync-logger");
var readline = require('readline');
var CONFIG_OBJECT = config.retrieveConfig();
var PROMPTDATA = [];
var DEFAULTPROMPT = "What action would you like to perform? ";
var COMPLETIONS = [];
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: inputCompleter
});

function inputCompleter( line ){
	var returnArray = [ line ];
	var completionHits = COMPLETIONS.filter(
		function( input ){
			return input.indexOf( line ) == 0;
		});
	if( completionHits.length ){
		returnArray.unshift( completionHits );
	}else{
		sync_logger.logFailure( "\nNo Matching Completion" );
		returnArray.unshift( COMPLETIONS );
	}
	return returnArray;
}

function showPrompt( resetPromptData, promptMessage, newCompletions ) {
	promptMessage = promptMessage || DEFAULTPROMPT;
	COMPLETIONS = newCompletions || Object.keys( CLIObject ).sort();
	if( resetPromptData ){
		PROMPTDATA = [];
	}
	rl.setPrompt( promptMessage );
	rl.prompt();
}

var CLIObject = {
	"add-instance": function( promptLength ){
		switch ( promptLength ){
			case 1:
				showPrompt( false, "Folder Name: ",[]);
				break;
			case 2:
				showPrompt( false, "Instance Name: ",[]);
				break;
			case 3:
				showPrompt( false, "Username: ",[]);
				break;
			case 4:
				showPrompt( false, "Password: ",[]);
				break;
			case 5:
				showPrompt( false, "JSON Version: ", "JSON JSONv2".split(" ").sort() );
				break;
			case 6:
				showPrompt( false, "Read Only: ", "true false".split(" ").sort() );
				break;
			case 7:
				CONFIG_OBJECT = config.createInstance(
					PROMPTDATA[1],
					PROMPTDATA[2],
					PROMPTDATA[3],
					PROMPTDATA[4],
					PROMPTDATA[5],
					PROMPTDATA[6],
					PROMPTDATA[7]
				);
				showPrompt( true );
				break;
			default:
				showPrompt( true );
				break;
		}
	},
	"update-instance": function( promptLength ){

	},
	"remove-instance": function( promptLength ){

	},
	"add-table": function( promptLength ){
		switch ( promptLength ){
			case 1:
				showPrompt( false, "Folder Name: ",[]);
				break;
			case 2:
				showPrompt( false, "Table Name: ",[]);
				break;
			case 3:
				showPrompt( false, "Identifier Field Name: ",[]);
				break;
			case 4:
				showPrompt( false, "Code Field Name: ",[]);
				break;
			case 5:
				showPrompt( false, "File Extension Name: ",[]);
				break;
			case 6:
				var fields = {};
				fields[ PROMPTDATA[4] ] = PROMPTDATA[5];
				CONFIG_OBJECT = config.createTable(
					PROMPTDATA[1],
					PROMPTDATA[2],
					PROMPTDATA[3],
					fields
				);
				showPrompt( true );
				break;
			default:
				showPrompt( true );
				break;
		}
	},
	"update-table": function( promptLength ){

	},
	"remove-table": function( promptLength ){

	},
	"add-field": function( promptLength ){
		switch( promptLength ){
			case 1:
				showPrompt( false, "Folder Name: ",[]);
				break;
			case 2:
				showPrompt( false, "Code Field Name: ",[]);
				break;
			case 3:
				showPrompt( false, "File Extension Name: ",[]);
				break;
			case 4:
				break;
			default:
				showPrompt( true );
		}
	},
	"update-field": function( promptLength ){

	},
	"remove-field": function( promptLength ){

	},
	watch: function(){
		var fileMonitor = new monitor();
	},
	exit: function(){
		rl.close();
	}
}

function interpretCLI( action ){
	var promptSelection = action;
	if (PROMPTDATA[ 0 ]) {
		promptSelection = PROMPTDATA[ 0 ];
	}
	PROMPTDATA.push( action );
	var promptDataLength = PROMPTDATA.length;
	if( CLIObject[ promptSelection ] ){
		CLIObject[ promptSelection ]( promptDataLength );
	}else{
		showPrompt( true );
	}
}

function closeCLI() {
	sync_logger.logSuccess( "Goodbye" );
	process.exit( 0 );
}

function getInstance( instanceName ){
	if( instanceName ){
		if( CONFIG_OBJECT.instances[ instanceName ]){
			return CONFIG_OBJECT.instances[ instanceName ]
		}	
	} else {
		return CONFIG_OBJECT.instances;
	}
}

function getTable( tableName ){
	if( tableName ){
		if( CONFIG_OBJECT.tables[ tableName ] ){
			return CONFIG_OBJECT.tables[ tableName ]
		}	
	} else {
		return CONFIG_OBJECT.tables;
	}	
}

rl.on( "line",interpretCLI );
rl.on( "close", closeCLI );
showPrompt( true );

/*exports.retrieveInstances = function(instanceName){
	return getInstance(instanceName);
};

exports.retrieveTable = function(tableName){
	return getTable(tableName);
};*/

