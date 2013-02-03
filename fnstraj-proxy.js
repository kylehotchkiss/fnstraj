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
var hashids   = require('hashids');
var express  = require('express');
var database = require('./library/database.js');
var proxy    = express();
proxy.use(express.bodyParser());


/////////////////////////////
// ENVIRONMENTAL VARIABLES //
/////////////////////////////
var fnstraj_salt = process.env.FNSTRAJ_SALT;
var process_port = process.env.PORT;
var hashid = new hashids(fnstraj_salt);


//////////////////////////////
// DATABASE REQUEST FORWARD //
//////////////////////////////
proxy.post('/', function( req, res ) {

	var flightID = hashid.encrypt( new Date().getTime() );

	var content = {
		parameters: {
			flags: {
				spot: false,
				active: false,
				lastActivity: false
			}, meta: {
				name: req.body.name,
				email: req.body.email,
				program: req.body.program
			}, options: {
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
			}, payload: {
				weight: req.body.weight,
				chuteRadius: req.body.chuteRadius,
			}
		}
	};

	database.write('/queue/' + flightID, content, function( error ) {
		if ( typeof error !== "undefined" && error ) {
			console.log("  databasefail: " + error.message);

			res.send("failure :(");
		} else {
			res.send("<h3>Successfully Posted!</h3><p>Your trajectory has been recieved and added to our processing queue. Because fnstraj is new software, your prediction may fail. You will recieve an email informing you what happened soon!");
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
proxy.listen(process_port);