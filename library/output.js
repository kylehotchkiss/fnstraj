/**
*
* fnstraj | exports
* Copyright 2011-2012 Hotchkissmade
* Released under the GPL
*
*/
var fs    = require('fs');
var async = require('async');



////////////////////////////////////////
// MODULAR FILE EXPORTS (in parallel) //
////////////////////////////////////////
exports.writeFiles = function( flight, table, parentCallback ) {
	async.parallel([
		//
		// Just throw in any other output functions
		// below and then add them to this array.
		//
		function( callback ) {
			exports.writeCSV( flight, table, callback );
		},

		function( callback ) {
			exports.writeKML( flight, table, callback );
		},

		function( callback ) {
			exports.writeJSON( flight, table, callback );
		}
	], function( error, results ) {
		parentCallback();
	});

}



////////////////////////////////////////
// CSV (Comma Seperated Value) EXPORT //
////////////////////////////////////////
exports.writeCSV = function( flight, table, callback ) {
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
exports.writeKML = function( flight, table, callback ) {
	var color;
	var model = flight.options.model;

	if ( model === "rap" ) {
		color = "BDC5A7";
	} else if ( model === "gfs" ) {
		color = "597BEB";
	} else if ( model === "gfshd" ) {
		color = "4746CF";
	}

	var fileContents = "\
<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<kml xmlns=\"http://earth.google.com/kml/2.1\">\n\
	<Document>\n\
		<name>fnstraj Balloon Trajectory</name>\n\
		<Style id=\"track\">\n\
	  		<LineStyle>\n\
				<color>FF" + color + "</color>\n\
				<width>3</width>\n\
	  		</LineStyle>\n\
	  		<PolyStyle>\n\
				<color>64" + color + "</color>\n\
	  		</PolyStyle>\n\
		</Style>\n\
		<Placemark>\n\
			<name>Balloon Trajectory</name>\n\
			<styleUrl>#track</styleUrl>\n\
			<LineString>\n\
				<tessellate>0</tessellate>\n\
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

	fs.writeFile("exports/flight-name." + model + ".kml", fileContents, function( error ) {
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
exports.writeJSON = function( flight, table, callback ) {

	var fileContents = JSON.stringify( table );

	fs.writeFile("exports/flight-name.json", fileContents, function( error ) {
		if ( error ) {
			callback( true );
		} else {
			callback();
		}
	});

}