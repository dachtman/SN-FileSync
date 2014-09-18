var moment = require( "moment" );
var colors = require( "colors" );

function logMessage ( message ){
	var now = moment().format("YYYY-MM-DD HH:mm:ss").grey;
	console.log(now,message)
}

exports.logSuccess = function( message ){
	logMessage( message.green );
};

exports.logFailure = function( message ){
	logMessage( message.red );
};

exports.logTitle = function( message ){
	logMessage( message.blue );
}