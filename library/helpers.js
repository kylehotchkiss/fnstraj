/**
 *
 * fnstraj | helpers
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 */

var http = require("http");


////////////////////////////////////
// Locality name from Coordinates //
////////////////////////////////////
exports.coordsToCity = function( latitude, longitude, callback ) {
	var location = "";

	var geocode = http.get({
		host: 'maps.googleapis.com',
		path: "/maps/api/geocode/json?address=" + latitude + ',' + longitude + "&sensor=true",
	}, function( response ) {
		response.setEncoding('utf8');

		response.on("data", function( data ) {
			location += data
		});

		response.on("end", function() {
			data = JSON.parse(location);
			locale = "";

			if ( data.status == "OK" ) {
				var components = data.results[0].address_components;

				for ( level in components ) {
					if (components[level].types[0] === "administrative_area_level_2" || components[level].types[0] === "administrative_area_level_1" ) {
						locale = components[level].short_name;

						break;
					}
				}

				callback( locale );

			} else {
				callback();
		   }
	   });
	});

	geocode.on('error', function() {
		callback();
	});
}

//
// Email User
//