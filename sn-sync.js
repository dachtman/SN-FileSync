//READING WRITING TO SN
// Requires
var config = require("./config");

privateFunction = function(){
	return config.root;
}

exports.public_function = function(){
	return privateFunction()
}