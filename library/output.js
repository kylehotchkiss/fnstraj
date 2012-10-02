/**
*
* fnstraj | exports
* Copyright 2011-2012 Hotchkissmade
* Released under the GPL
*
*/ 
var fs    = require('fs');
var async = require('async');



exports.writeFiles = function( table, parentCallback ) {
	
	async.parallel([
		//////////////////////////
		// Modular File Outputs //
		//////////////////////////
		function( callback ) {
			exports.writeCSV( table, callback );
		},
		
		function( callback ) {
			exports.writeKML( table, callback );
		},
		
		function( callback ) {
			exports.writeJSON( table, callback );
		}
	], function( error, results ) {
		parentCallback();
	});
	
}



////////////////////////////////////////
// CSV (Comma Seperated Value) EXPORT //
////////////////////////////////////////
exports.writeCSV = function( table, callback ) {
	var fileContents = "";
	
	for ( i = 0; i < table.length; i++ ) {
		fileContents += table[i].longitude + "," + table[i].latitude + "," + table[i].altitude + "\n";
	}
	
	fs.writeFile("exports/flight-name.csv", fileContents, function( error ) {
		if ( error ) {
			callback( true );
		} else {
			callback();
		}
	}); 
	
}



///////////////////////////////
// KML (Google Earth) EXPORT //
///////////////////////////////
exports.writeKML = function( table, callback ) {
	
	var fileContents = "\
<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<kml xmlns=\"http://earth.google.com/kml/2.1\">\n\
	<Document>\n\
		<name>fnstraj Balloon Trajectory</name>\n\
		<Style id=\"track\">\n\
	  		<LineStyle>\n\
			<color>fff010c0</color>\n\
	  	</LineStyle>\n\
	  	<PolyStyle>\n\
			<color>3fc00880</color>\n\
	  	</PolyStyle>\n\
	</Style>\n\
	<Placemark>\n\
		<name>Balloon Trajectory</name>\n\
			<LineString>\n\
				<tessellate>1</tessellate>\n\
				<extrude>1</extrude>\n\
				<altitudeMode>absolute</altitudeMode>\n\
				<coordinates>\n";
	
	for ( i = 0; i < table.length; i++ ) {
		fileContents += "				    " + table[i].longitude + "," + table[i].latitude + "," + table[i].altitude + "\n";
	}
	
	fileContents += "\
				</coordinates>\n\
        	</LineString>\n\
    	</Placemark>\n\
	</Document>\n\
</kml>";

	fs.writeFile("exports/flight-name.kml", fileContents, function( error ) {
		if ( error ) {
			callback( true );
		} else {
			callback();
		}
	}); 
	
}


///////////////////////////////////////
// JSON (fnstraj file format) EXPORT //
///////////////////////////////////////
exports.writeJSON = function( table, callback ) {
	
	var fileContents = JSON.stringify( table );
	
	fs.writeFile("exports/flight-name.json", fileContents, function( error ) {
		if ( error ) {
			callback( true );
		} else {
			callback();
		}
	}); 

}