/**
 *
 * fnstraj | Worker Process
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * If possible, write-less spot update checks.
 * Should save us over 300 requests/SPOT hour.
 *
 */


/////////////////////////
// INCLUDES AND CONFIG //
/////////////////////////
var log = require('loglevel');
var couchdb = require('couchdb-simple');
var queue = require('couchdb-queue');

var meta = require('./package.json');
var spot = require('./library/spot.js');
var fnstraj	= require('./library/fnstraj.js');
var helpers	= require('./library/helpers.js');

var fnstraj_sleep = process.env.FNSTRAJ_SLEEP || 3000;
var fnstraj_loglevel = process.env.FNSTRAJ_LOGLEVEL || "debug";

var db_host = process.env.COUCHDB_HOST;
var db_port = process.env.COUCHDB_PORT;
var db_user = process.env.COUCHDB_USER;
var db_pass = process.env.COUCHDB_PASS;

log.setLevel( fnstraj_loglevel );
var database = new couchdb( db_host, db_port, db_user, db_pass );

var daemon = function() {
	var worker = new queue({
		host: db_host, port: db_port, user: db_user, pass: db_pass, path: '/fnstraj-queue/', wait: fnstraj_sleep
	}, function( flight, callback ) {
		var id = flight._id;

		if ( flight.parameters.flags.active ) {
			//////////////////////////////////////////////
			// CASE: Queue item currently active - PASS //
			//////////////////////////////////////////////

			callback( true );
		} else {
			var timestamp = new Date().getTime();

			///////////////////////////////////////
			// DATA INITIALIZATION AND CLEANSING //
			///////////////////////////////////////
			flight.parameters.flags.active = true;
			flight.parameters.options.context = "daemon";
			flight.parameters.options.flightID = id;
			flight.parameters.launch.altitude = parseFloat(flight.parameters.launch.altitude);
			flight.parameters.launch.latiude = parseFloat(flight.parameters.launch.latitude);
			flight.parameters.launch.longitude = parseFloat(flight.parameters.launch.longitude);
			flight.parameters.launch.timestamp = timestamp;
			flight.parameters.balloon.lift = parseFloat(flight.parameters.balloon.lift);
			flight.parameters.balloon.burst = parseFloat(flight.parameters.balloon.burst);
			flight.parameters.balloon.burstRadius = parseFloat(flight.parameters.balloon.burstRadius);
			flight.parameters.balloon.launchRadius = parseFloat(flight.parameters.balloon.launchRadius);
			flight.parameters.payload.weight = parseFloat(flight.parameters.payload.weight);
			flight.parameters.payload.chuteRadius = parseFloat(flight.parameters.payload.chuteRadius);

			/////////////////////////////////
			// Set our ACTIVE flag to TRUE //
			/////////////////////////////////
			database.write('/fnstraj-queue/' + id, { parameters: flight.parameters }, function( error ) {
				flight.parameters.flags.active = false;

				if ( flight.parameters.flags.spot ) {
					//////////////////////////////////////////
					// SPOT Tracking / Live Trajectory Mode //
					//////////////////////////////////////////
					spot.getTracking( flight.parameters.flags.spot, function( tracking, error ) {
						if ( typeof error !== "undefined" && error ) {
							/////////////////////////////////////
							// CASE: POINTS UNAVAILABLE - PASS //
							/////////////////////////////////////
							
							// Notify user to power on their SPOT.
							
							// Safe to delete
							callback();
						} else {
							//////////////////////////////////////////
							// CASE: TRACKING DATA EXISTS - FORWARD //
							//////////////////////////////////////////
							database.read('/fnstraj-flights/' + id, function( prevFlight, prevError ) {
								if ( typeof error !== "undefined" && error ) {
									////////////////////////////////
									// CASE: DATABASE DOWN - PASS //
									////////////////////////////////
									callback();
								} else {
									if ( typeof prevError !== "undefined" && prevError ) {
										///////////////////////////////////////////
										// Run First Prediction of SPOT Tracking //
										///////////////////////////////////////////
										log.info("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m \x1B[43;30m spot \x1B[0m");

										fnstraj.predict( flight.parameters, false, function( predictorError ) {
											database.write('/fnstraj-queue/' + id, { parameters: flight.parameters }, function( error ) {
												if ( typeof predictorError !== "undefined" && predictorError ) {
													///////////////////////////////////////
													// CASE: PREDICTION FAILED - FORWARD //
													///////////////////////////////////////

												} else {
													//////////////////////////////
													// CASE: COMPLETE - FORWARD //
													//////////////////////////////

													log.info("Complete: flight #" + flight.parameters.options.flightID);
												}

												callback( true );
											});
										});

									} else {
										///////////////////////////////////////
										// Run From Last SPOT Tracking Point //
										///////////////////////////////////////
										var repredict = spot.processTracking( tracking, prevFlight );
										var overrideMessage = "";

										if ( flight.parameters.launch.timestamp < ( prevFlight.parameters.launch.timestamp + ( prevFlight.prediction[0].length * 1000 * 60 )) ) {
											if ( repredict ) {
												//////////////////////////////////////////
												// CASE: REPREDICT FROM LAST SPOT POINT //
												//////////////////////////////////////////
												prevFlight.parameters.options.launchOffset = repredict;

												if ( spot.determineOverride( tracking, prevFlight ) ) {
													prevFlight.parameters.options.overrideClimb = true;
													overrideMessage = " \x1B[47;30m override \x1B[0m";
												}

												prevFlight.parameters.launch.latitude  = prevFlight.flightpath[repredict].latitude;
												prevFlight.parameters.launch.longitude = prevFlight.flightpath[repredict].longitude;
												prevFlight.parameters.launch.altitude  = prevFlight.prediction[0][repredict].altitude;

												log.info("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m \x1B[43;30m spot \x1B[0m" + overrideMessage);

												fnstraj.predict( prevFlight.parameters, prevFlight.flightpath, function( predictorError ) {
													database.write('/fnstraj-queue/' + id, { parameters: flight.parameters }, function( error ) {
														if ( typeof predictorError !== "undefined" && predictorError ) {
															/////////////////////////////
															// Prediction Failed Email //
															/////////////////////////////
															if ( flight.parameters.meta.email !== "" ) {
																emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

																helpers.sendMail( flight.parameters.meta.email, "fnstraj failed: flight #" + id, emailContent);
															}
														} else {
															/////////////////////////////////
															// Prediction Completion Email //
															/////////////////////////////////
															log.info("Complete: flight #" + flight.parameters.options.flightID);

															if ( flight.parameters.meta.email !== "" ) {
																emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + id + "\n\nThanks for experimenting with us,\n-fnstraj";

																helpers.sendMail( flight.parameters.meta.email, "fnstraj prediction: flight #" + id, emailContent );
															}
														}

														callback( true );
													});
												});
											} else {
												/////////////////////////////////////////
												// CASE: NO NEW TRACKING POINTS - PASS //
												/////////////////////////////////////////
												database.write('/fnstraj-queue/' + id, { parameters: flight.parameters }, function( error ) {
													callback( true );
												});
											}
										} else {
											log.info("Spot Livetrack Done");

											// Safe to Delete
											callback();
										}
									}
								}
							});
						}
					});

				} else {
					//////////////////////////////////////////
					// RUN PREDICTOR BASED ON FLIGHT OBJECT //
					//////////////////////////////////////////
					log.info("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m");

					fnstraj.predict( flight.parameters, false, function( error ) {
						if ( typeof error !== "undefined" && error ) {
							/////////////////////////////
							// Prediction Failed Email //
							/////////////////////////////
							if ( flight.parameters.meta.email !== "" ) {
								emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

								helpers.sendMail( flight.parameters.meta.email, "fnstraj failed: flight #" + id, emailContent );
							}
							
							// Safe to Delete
							callback();
						} else {
							/////////////////////////////////
							// Prediction Completion Email //
							/////////////////////////////////
							log.info("Complete: flight #" + flight.parameters.options.flightID);
							
							if ( flight.parameters.meta.email !== "" ) {
								emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + id + "\n\nThanks for experimenting with us,\n-fnstraj";

								helpers.sendMail( flight.parameters.meta.email, "fnstraj prediction: flight #" + id, emailContent );
							}
							
							// Safe to Delete
							callback();
						}
					});
				}
			});
		}
	});
}


////////////////////////////////
// INITIALIZE AND RUN FNSTRAJ //
////////////////////////////////

	//////////////////////////////////////////////
	// Database Configuration and Status Checks //
	//////////////////////////////////////////////
	log.info("\x1B[47;30m fnstraj backend, v." + meta.version + " \x1B[0m");

	if (
		typeof process.env.COUCHDB_HOST === "undefined" ||
		typeof process.env.COUCHDB_PORT === "undefined" ||
		typeof process.env.COUCHDB_USER === "undefined" ||
		typeof process.env.COUCHDB_PASS === "undefined"
	) {
		log.error("Database configuration unavailable! RTFM! ...dies...");
	} else {

		if ( typeof process.env.FNSTRAJ_SLEEP === "undefined" ) {
			log.info("FNSTRAJ_SLEEP was undefined, defaulting to 3 seconds.");
		}

		if ( typeof process.argv[2] === "string" && !isNaN(parseInt(process.argv[2], 10)) ) {
			//////////////////////////////////////////////////////
			// CASE: OFFSET FOUND IN ARGUMENTS, RUN WITH OFFSET //
			//////////////////////////////////////////////////////
			setTimeout(function() {
				daemon();
			}, ( process.argv[2] * 1000 ));
		} else {
			daemon();
		}
	}
