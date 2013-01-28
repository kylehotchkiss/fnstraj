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

	var content = {
		parameters: {
			meta: {
				name: "",
				email: "",
				program: ""
			},options: {
				model: req.body.model,
			}, launch: {
				altitude:  req.body.altitude,
				latitude:  req.body.latitude,
				longitude: req.body.longitude
			}, balloon: {
				lift: req.body.lift,
				burst: req.body.burst,
				burstRadius: req.body.burstRadius,
				launchRadius: req.body.launchRadius
			},
			payload: {
				weight: req.body.weight,
				chuteRadius: req.body.chuteRadius,
			}
		}
	};
	

	database.write('/queue/' + Math.round((Math.random() * 10000)), content, function( error ) {
		if ( typeof error !== "undefined" && error ) {
			console.log("  databasefail: " + error.message);

			// wtf errors not showing up here

			res.send("failure :(");
		} else {
			res.send("success :)");
		}
	});

	////////////////////////
	// CORS Configuration //
	////////////////////////
	res.setHeader('Access-Control-Allow-Origin', '*'); // Eventually this will need to only work for fnstraj.org
	res.setHeader('Access-Control-Allow-Methods', 'POST');
});



///////////////
// RUN PROXY //
///////////////
proxy.listen(1337);