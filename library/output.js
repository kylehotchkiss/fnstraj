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
var couchdb  = require('couchdb-simple');

var db_host = process.env.COUCHDB_HOST;
var db_port = process.env.COUCHDB_PORT;
var db_user = process.env.COUCHDB_USER;
var db_pass = process.env.COUCHDB_PASS;

var database = new couchdb( db_host, db_port, db_user, db_pass );


////////////////////////////////////////
// CSV (Comma Seperated Value) EXPORT //
////////////////////////////////////////
var writeCSV = function( flight, table, callback ) {
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
var writeKML = function( flight, table, callback ) {
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
var writeJSON = function( flight, table, callback ) {
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
// DATABASE (CouchDB) EXPORT //
///////////////////////////////
var writeDatabase = function ( flight, table, tracking, analysis, callback ) {
	//
	// How do we know how to append data?
	// We may need to grab this first and see the prediction count
	// then we have to append to that. We don't have offset tracking,
	// which would help
	//
	var predictionIndex, predictionTable;
	var flightID = flight.options.flightID;

	database.read( "/fnstraj-flights/" + flightID, function( results, error ) {
		if ( typeof error !== "undefined" && error ) {
			//////////////////////////////////////////
			// CASE: FLIGHT DOESN'T EXIST, INITIATE //
			//////////////////////////////////////////

			predictionIndex = 0;
			predictionTable = [ table ];
		} else {
			////////////////////////////////////
			// CASE: FLIGHT EXISTS, APPENDING //
			////////////////////////////////////
			predictionIndex = flight.options.launchOffset;
			predictionTable = results.prediction;
			predictionTable[predictionIndex] = table;
		}

		var content  = { parameters: flight, analysis: analysis};

		content.prediction = predictionTable;

		if ( tracking ) {
			content.flightpath = tracking;
		}

		database.write( "/fnstraj-flights/" + flightID, content, function( error ) {
			if ( typeof error !== "undefined" && error ) {
				console.log("  databasefail: " + error.message);
				callback( true );
			} else {
				callback();
			}
		});

	});
}


///////////////////////////////
// LOG AND STATISTICS EXPORT //
///////////////////////////////
var writeStats = function ( flight, stats, callback ) {
	var flightID = flight.options.flightID;

	database.write( "/fnstraj-statistics/" + flightID, stats, function( error ) {
		if ( typeof error !== "undefined" && error ) {
			// We don't care that much.
			callback( true );
		} else {
			callback();
		}
	});
}


////////////////////////////////////////
// MODULAR FILE EXPORTS (in parallel) //
////////////////////////////////////////
exports.export = function( flight, table, tracking, analysis, stats, parentCallback ) {
	///////////////////////////
	// CONTEXT-BASED OUTPUTS //
	///////////////////////////
	if ( false ) {
		////////////////////////////////////////////////////////////
		// We'll figure out something else for these file outputs //
		////////////////////////////////////////////////////////////
		async.parallel([
			function( callback ) {
				writeCSV( flight, table, callback );
			}, function( callback ) {
				writeKML( flight, table, callback );
			}, function( callback ) {
				writeJSON( flight, table, callback );
			}
		], function( error, results ) {
			parentCallback();
		});
	} else {
		async.parallel([
			function( callback ) {
				if ( tracking ) {
					writeDatabase( flight, table, tracking, analysis, callback );
				} else {
					writeDatabase( flight, table, false, analysis, callback );
				}
			}, function( callback ) {
				writeStats( flight, stats, callback );
			}
		], function( error, results ) {
			parentCallback();
		});
	}

}