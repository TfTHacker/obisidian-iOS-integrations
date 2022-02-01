// Developer: TfTHacker
// Last update: 2022-02-01
//
// == Purpose ==
// This Scriptable (https://scriptable.app) script creates a widget for iOS screen that pulls information 
//	from an Obsidian vault (https://obsidian.md). The widget can show a number of possible things:
// - Show recent files (need to install the community plugin "Recent Files"  https://github.com/tgrosinger/recent-files-obsidian
// - Show starred files from a vault (need to install the Starred core plugin)
// - Display the contents of a specific folder
// - Display the contents of a file
//
//	== Installation == 
//	- on your iOS device, install the Scriptable appliation from the App Store
// - In the scriptable app, create a new script and copy the contents of this file into that new script. 
// - Rename the script to something useful, for example "Obsidian Widget"
// - On the iOS screen, add a new widget, selecting the "Scriptable" widget from the list of widgets
// - Select the size of the widget. All sizes are supported by this script.
// - In the settings for the widget you placed on your screen, edit the widget settings and define the following:
//   - Script - Name of the script you made in Scriptable
//   - When interacting - Leave as "Open app"
//   - Param - this is where you define the information about how the widget should function. Please see detailed description below for supported parameters
//
// == Param - Parameters for the widget ==
// The widget accepts a number of parameters via the param field in the widgets settings. Parameters are seperated by two pipes like this: ||
// So param1 and param2 would be put in the param field and seperated with two pipes. For example: param1||param2
// 
// Parameters
// Parameter 1: Bookmark name for vault
// Parameter 2: Type of widget to display
// Parameter 3: Additional information for the type of 
// Widget parameter seperated by ||
//  Bookmark name (not optional) - this is a named bookmark pointing the vault name. The bookmark and vault name should be the same
//  Mode (optiona). 4 options: RECENT(default), FOLDER, STARRED, FILE
//  Path (optiona). path to file (with md) or folder (without vault name)
// Examples:
//    My Vault
//    My Vault||folder||/folderPath
//    My Vault||file||/folderPath/fileName.md

const testParameter="MyVault||Recent";

const params = (args.widgetParameter ? args.widgetParameter : testParameter).split("||"); 
const paramBookmark = params[0]; // in Scriptable settings, create a bookmark to your vault
const paramMode = params[1] ? (params[1]).toUpperCase() : "RECENT"; 
const paramPath = params[2]; 
const refreshRateInSeconds = 300;

const WIDGET_FONTS = {
    small: 		{ WIDGET_TITLE: 20, WIDGET_DESCRIPTION: 14, rowOutput: 5  },
    medium: 		{ WIDGET_TITLE: 22, WIDGET_DESCRIPTION: 14, rowOutput: 5  },
    large: 		{ WIDGET_TITLE: 24, WIDGET_DESCRIPTION: 14, rowOutput: 12 },
    extraLarge: 	{ WIDGET_TITLE: 26, WIDGET_DESCRIPTION: 15, rowOutput: 12 },
    default: 	{ WIDGET_TITLE: 20, WIDGET_DESCRIPTION: 14, rowOutput: 12 }
}

const fm = FileManager.local();
const widget = await createWidget()

if (config.runsInWidget) {
    Script.setWidget(widget);
} else {
    //widget.presentMedium();
    widget.presentLarge();
    //widget.presentExtraLarge();
}
Script.complete()

async function createWidget() {
	let widget = new ListWidget();
	widget.spacing=-2;
	widget.refreshAfterDate = new Date(Date.now() + 1000 * refreshRateInSeconds); // add XX second to now

   const titleStack = widget.addStack();
   titleStack.setPadding(10, 0, 10, 0);
   let titleText = paramPath ?  paramPath.replace(".md","") : "";
  	if(paramMode==="RECENT") titleText = "Recent";
  	if(paramMode==="STARRED") titleText = "Starred";
   const widgetTitleText = titleStack.addText( "Obsidian: " + titleText );
   widgetTitleText.font = Font.boldSystemFont(getWidgetFont('WIDGET_TITLE'));
	
  	if( !fm.bookmarkExists(paramBookmark) ) {
	  	errorMessage(widget, "The Scriptable bookmark does not exist for your Obsidian vault. Open settings in Scriptable and create a Bookmark to the root folder of your vault.");
	} else {  
		if(paramMode==="RECENT")
			await displayRecentFiles(widget);
	 	else if(paramMode==="STARRED")
			await displayStarredFiles(widget);
	 	else if(paramMode==="FOLDER")
			await displayFilesFromFolder(widget);
  		else if(paramMode==="FILE") 
  			await displayFile(widget)
	}
	 widget.addSpacer();
    return widget;
}

async function displayFile(widget) {
  	const vaultPath = fm.bookmarkedPath(paramBookmark); 
	const contentsString = await fm.readString( vaultPath + "/" + paramPath );
	const row = widget.addStack();
	const fileName = row.addText( contentsString );
	if (!config.runsWithSiri) row.url = `obsidian://open?vault=${encodeURIComponent(paramBookmark)}&file=${encodeURIComponent(paramPath)}`;
}

async function displayRecentFiles(widget) {
  	const vaultPath = fm.bookmarkedPath(paramBookmark); 
	const contentsString = await fm.readString( vaultPath + "/.obsidian/plugins/recent-files-obsidian/data.json" );
	const rf = contentsString===null ? null : JSON.parse(contentsString).recentFiles;
   
  	if (rf===null) return	errorMessage(widget, "No recent files information found. Perhaps the Recent Files plugin is not installed in Obsidian. More info on this plugin can be found at: https://github.com/tgrosinger/recent-files-obsidian", "https://github.com/tgrosinger/recent-files-obsidian");

	const maxCount = rf.length > getWidgetFont('rowOutput') ? getWidgetFont('rowOutput') : rf.length;
	for (let i = 0; i < maxCount; i++) {
   		await addItem(widget, rf[i]);
       if (i != rf.length - 1) widget.addSpacer(5);
	}
}

async function displayFilesFromFolder(widget) {
	const vaultPath = fm.bookmarkedPath(paramBookmark); 
	const fullPath = vaultPath + paramPath;
	if(fm.isDirectory(fullPath)===false) 
 		return errorMessage(widget, "The folder path is not valid. Please update the parameter for this widget");

	const folderContents = await fm.listContents(fullPath);
	folderContents.sort((a,b)=>a>b); // sort the array

	const maxCount = folderContents.length > getWidgetFont('rowOutput') ? getWidgetFont('rowOutput') : folderContents.length;
	for (let i = 0; i < maxCount; i++) {
  		if(fm.isDirectory(vaultPath + "/" + folderContents[i])===false) {
	  		const data = { basename: folderContents[i], path: folderContents[i] };
			await addItem(widget, data);
			if (i != folderContents.length - 1) widget.addSpacer(5);
  		}
	}  
}

async function displayStarredFiles(widget) {
  	const vaultPath = fm.bookmarkedPath(paramBookmark); 
	const contentsString = await fm.readString( vaultPath + "/.obsidian/starred.json" );
	const starred = contentsString===null ? null : JSON.parse(contentsString).items;
   
  	if (starred===null) return	errorMessage(widget, "No starred files found. Perhaps the Starred core plugin is not enabled or you have not starred any files in this vault yet");

	const maxCount = starred.length > getWidgetFont('rowOutput') ? getWidgetFont('rowOutput') : starred.length;
	for (let i = 0; i < maxCount; i++) {
		const data = { basename: starred[i].title, path: (starred[i].path || starred[i].query) };
		const uriType = starred[i].type === "search" ? "search" : "open";
   		await addItem(widget, data, uriType);
      if (i != starred.length - 1) widget.addSpacer(5);
	}
}

async function addItem(widget, doc, uriType="open") {
  	//exmaple doc: {"basename":"2021-08-24","path":"f/DNP/2021-08-24.md"}
    const row = widget.addStack();
    const dot = row.addText( "• "  );
    const fileName = row.addText( doc.basename );
    row.addSpacer();
    if (!config.runsWithSiri) {
		const encodedPath = encodeURIComponent(doc.path);
		if(uriType==="search")
			row.url = `obsidian://search?vault=${encodeURIComponent(paramBookmark)}&query=${encodedPath}`;
		else //default is for uri type open
			row.url = `obsidian://open?vault=${encodeURIComponent(paramBookmark)}&file=${encodedPath}`;
    }
}

function errorMessage(widget, msg, url = "" ) {
	const errorText = widget.addText(msg);
	errorText.textColor = Color.white();
	errorText.font = Font.boldSystemFont(getWidgetFont('WIDGET_DESCRIPTION'));
	if(url!="") errorText.url = url;
	return widget;
}

function getWidgetFont(key) {
    return WIDGET_FONTS[config.widgetFamily] ? WIDGET_FONTS[config.widgetFamily][key] : WIDGET_FONTS.default[key];
}

