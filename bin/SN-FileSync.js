var monitor = require("../lib/monitor");
var sn_sync = require("../lib/sn-sync");
var config = require("../lib/configurator");
var sync_logger = require("../lib/sync-logger");
var readline = require('readline');
var async = require("async");
var CONFIG_OBJECT = config.retrieveConfig();
var PROMPTDATA = [];
var DEFAULTPROMPT = "What action would you like to perform? ";
var COMPLETIONS = [];
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: inputCompleter
});
var FILEMONITOR;

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
		configureNextPrompt({
				"Folder Name":[],
				"Instance Name":[],
				"Username":[],
				"Password":[],
				"JSON Version": "JSON JSONv2".split(" ").sort(),
				"Read Only":"true false".split(" ").sort()
			},
			promptLength,
			config.createInstance
		);
	},
	"update-instance": function( promptLength ){
		configureNextPrompt({
				"Folder Name":Object.keys( getInstance() ).sort(),
				"Key to Update":"host json read_only username password last_synced".split(" ").sort(),
				"New Value":[]
			},
			promptLength,
			config.updateInstanceFolder
		);
	},
	"remove-instance": function( promptLength ){
		configureNextPrompt({
				"Folder Name":Object.keys( getInstance() ).sort()
			},
			promptLength,
			config.removeInstanceFolder
		);
	},
	"add-table": function( promptLength ){
		configureNextPrompt({
				"Folder Name":[],
				"Table Name":[],
				"Identifier Field Name":[],
				"Code Field Name":[],
				"File Extension": []
			},
			promptLength,
			config.createTable
		);
	},
	"update-table": function( promptLength ){
			configureNextPrompt({
				"Folder Name":Object.keys( getTable() ).sort(),
				"Key To Update":"table key".split(" ").sort(),
				"New Value":[]
			},
			promptLength,
			config.updateTableFolder
		);
	},
	"remove-table": function( promptLength ){
			configureNextPrompt({
				"Folder Name":Object.keys( getTable() ).sort()
			},
			promptLength,
			config.removeTableFolder
		);
	},
	"add-field": function( promptLength ){
		configureNextPrompt({
				"Folder Name":Object.keys( getTable() ).sort(),
				"Code Field Name":[],
				"File Extension": []
			},
			promptLength,
			createFieldUpdate
		);
	},
	"update-field": function( promptLength ){
		configureNextPrompt({
				"Folder Name":Object.keys( getTable() ).sort(),
				"Code Field Name":Object.keys( getFields( PROMPTDATA[1] ) ).sort(),
				"File Extension": []
			},
			promptLength,
			createFieldUpdate
		);
	},
	"remove-field": function( promptLength ){
		configureNextPrompt({
				"Folder Name":Object.keys( getTable() ).sort(),
				"Code Field Name":Object.keys( getFields( PROMPTDATA[1] ) ).sort()
			},
			promptLength,
			config.removeField
		);
	},
	"sync-files":function(promptLength){
		configureNextPrompt({
				"Instance Name":Object.keys( getInstance() ).sort(),
				"Table Name":Object.keys( getTable() ).sort(),
				"Specific Query":[]
			},
			promptLength,
			sn_sync.getRecords
		);
	},
	watch: function(){
		FILEMONITOR = new monitor();
		showPrompt(true,"Enter Stop to stop watching: \n");
	},
	stop:function(){
		FILEMONITOR.closeMonitor();
		showPrompt(true);
	},
	exit: function(){
		rl.close();
	}
}

function createFieldUpdate( folderName, fieldName, extension){
	try{
		var fields = CONFIG_OBJECT.tables[ folderName ].fields;
		fields[ fieldName ] = extension;
		config.updateTableFolder(folderName,"fields",fields);
	}
	catch(err){
		sync_logger.logFailure("One or more selections was not a valid option");
		sync_logger.logFailure("Folder Name: " + folderName);
		sync_logger.logFailure("Field Name: " + fieldName);
		sync_logger.logFailure("Extension: " + extension);
	}
}

function configureNextPrompt( promptObject, promptLength, callback ){
	var promptArray = Object.keys( promptObject );
	var promptPhrase = promptArray[ promptLength ];
	if( promptLength == promptArray.length ){
		PROMPTDATA.shift();
		callback.apply( this, PROMPTDATA);
		CONFIG_OBJECT = config.retrieveConfig();
		showPrompt( true );
	} else {
		showPrompt(
			false,
			promptPhrase + ": ",
			promptObject[ promptPhrase ]
		);
	}
}

function interpretCLI( action ){
	var promptSelection = action;
	if ( PROMPTDATA[ 0 ] ) {
		promptSelection = PROMPTDATA[ 0 ];
	}
	if(action != ""){
		PROMPTDATA.push( action );
	}
	if( !CLIObject[ promptSelection ] ){
		return showPrompt( true );
	}
	CLIObject[ promptSelection ]( PROMPTDATA.length - 1 );
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

function getFields( tableName ){
	if( tableName ){
		if( CONFIG_OBJECT.tables[ tableName ] ){
			return CONFIG_OBJECT.tables[ tableName ].fields
		}
	} else {
		return {};
	}

}

rl.on( "line",interpretCLI );
rl.on( "close", closeCLI );
showPrompt( true );

