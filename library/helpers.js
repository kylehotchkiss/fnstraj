/**
 *
 * fnstraj | helpers
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 */

var http        = require("http");
var https       = require("https");
var querystring = require('querystring');



var mailgun_key  = process.env.MAILGUN_KEY;
var mailgun_url  = process.env.MAILGUN_URL;
var mailgun_from = process.env.MAILGUN_FROM;



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



/////////////////////////////////
// Email Wrapper (via Mailgun) //
/////////////////////////////////
exports.sendMail = function( to, subject, body, callback ) {
    var status = "";
    
    var message = querystring.stringify({
        from: mailgun_from,
        to: to,
        subject: subject,
        text: body
    });

	var mailgun = https.request({
    	auth: "api" + ":key-" + mailgun_key,
    	host: "api.mailgun.net",
    	path: "/v2/" + mailgun_url + "/messages",
    	headers: {  
        	'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': message.length
        },
    	method: "POST"
	}, function() {
        if ( typeof callback !== "undefined" ) {
            callback();
        }
	}).on('error', function() {
        if ( typeof callback !== "undefined" ) {
            callback( true );
        }
    });
	
	mailgun.write( message );
	mailgun.end();
}
