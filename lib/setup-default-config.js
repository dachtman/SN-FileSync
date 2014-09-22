var config = require("./configurator.js");

//Create Business Rules
config.createTable("business_rules", "sys_script", "name", "script", "js");

//Create Client Scripts
config.createTable("client_scripts", "sys_script_client", "name", "script", "js");

//Create Client Scripts
config.createTable("processors", "sys_processor", "name", "script", "js");

//Create Client Scripts
config.createTable("script_includes", "sys_script_include", "name", "script", "js");

//Create Client Scripts
config.createTable("style_sheets", "content_css", "name", "style", "css");

//Create Client Scripts
config.createTable("ui_macros", "sys_ui_macro", "name", "xml", "xhtml");

//Create UI Scripts
config.createTable("ui_scripts", "sys_ui_script", "name", "script", "js");

//Create UI Pages
config.createTable("ui_pages", "sys_ui_page", "name", "script", "js");
config.updateTableFolder(
	"ui_pages",
	"fields",
	{"html":"xhtml","client_script":"client.js","processing_script":"server.js"}
);