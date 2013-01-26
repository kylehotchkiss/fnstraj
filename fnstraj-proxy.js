/**
 *
 * fnstraj | Database Proxy
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 */



////////////////////////////
// EXPRESS INITIALIZATION //
////////////////////////////
var express  = require('express');
var database = require('./library/database.js');
var proxy    = express();
proxy.use(express.bodyParser());



//////////////////////////////
// DATABASE REQUEST FORWARD //
//////////////////////////////
proxy.post('/', function( req, res ) {

	content = {
		parameters: {
			options: {
				model: req.body.model,
			},
			launch: {
				latitude:   req.body.latitude,
				longitude:  req.body.longitude,
				altitude:   0
			},
			balloon: {
				radius:     req.body.bRadius,
				lift:       req.body.lift,
				burst:      req.body.burst
			},
			parachute: {
				radius:     req.body.pRadius,
				weight:     0
			}
		}
	}

	database.write('/queue/' + Math.round((Math.random() * 10000)), content, function( error ) {
		if ( typeof error !== "undefined" && error ) {
			console.log("  databasefail: " + error.message);

			// wtf errors not showing up here

			res.send("failure :(");
		} else {
			res.send("success :)");
		}

	})
});



///////////////
// RUN PROXY //
///////////////
proxy.listen(1337);