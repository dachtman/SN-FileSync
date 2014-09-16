// Requires
var config = require("./config");

privateFunction = function(){
	return config.some_key;
}

exports.public_function = function(){
	return privateFunction()
}