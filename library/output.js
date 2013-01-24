/**
*
* fnstraj | exports
* Copyright 2011-2013 Kyle Hotchkiss
* Released under the GPL
*
*/
var fs       = require('fs');
var http     = require('http');
var async    = require('async');
var database = require('./database.js')



////////////////////////////////////////
// MODULAR FILE EXPORTS (in parallel) //
////////////////////////////////////////
exports.export = function( flight, table, stats, parentCallback ) {
	async.parallel([
		//
		// Just throw in any other output functions
		// below and then add them to this array.
		//
		// SaaS: run outputs based on context, or via options in primary file
		//
		function( callback ) {
			exports.writeCSV( flight, table, callback );
		},

		function( callback ) {
			exports.writeKML( flight, table, callback );
		},

		function( callback ) {
			exports.writeJSON( flight, table, callback );
		},
		function( callback ) {
			exports.writeDatabase( flight, table, callback );
		}
	], function( error, results ) {
		// Do we care about errors in each output?
		parentCallback();
	});

}



////////////////////////////////////////
// CSV (Comma Seperated Value) EXPORT //
////////////////////////////////////////
exports.writeCSV = function( flight, table, callback ) {
	var content = "";

	var flightID = flight.options.flightID;

	for ( i = 0; i < table.length; i++ ) {
		content += table[i].longitude + "," + table[i].latitude + "," + table[i].altitude + "\n";
	}

	fs.writeFile("exports/flight-" + flightID + ".csv", content, function( error ) {
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
	var flightID = flight.options.flightID;

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

	fs.writeFile("exports/flight-" + flightID + "." + model + ".kml", fileContents, function( error ) {
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
	var flightID = flight.options.flightID;
	var content = JSON.stringify( table );

	fs.writeFile("exports/flight-" + flightID +".json", content, function( error ) {
		if ( error ) {
			callback( true );
		} else {
			callback();
		}
	});

}



///////////////////////////////
// DATABASE (Couchdb) EXPORT //
///////////////////////////////
exports.writeDatabase = function ( flight, table, callback ) {
	//
	// In the future, this will have to manually append for
	// multiple prediction support.
	//
	var flightID = flight.options.flightID;
	var content  = { parameters: flight, prediction: [table] };

	database.write( "/flights/" + flightID, content, function( error ) {
		if ( typeof error !== "undefined" && error ) {
			console.log("  databasefail: " + error.message);			
			callback( true );
		} else {
			callback();
		}
	});
}


///////////////////////////////
// LOG AND STATISTICS EXPORT //
///////////////////////////////
exports.writeLog = function ( flight, stats, callback ) {

}