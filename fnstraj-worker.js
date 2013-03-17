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
var async = require('async');

var meta = require('./package.json');
var spot = require('./library/spot.js');
var fnstraj	= require('./library/fnstraj.js');
var helpers	= require('./library/helpers.js');
var database = require('./library/database.js');

var fnstraj_mode = process.env.FNSTRAJ_MODE || "development";
var fnstraj_sleep = process.env.FNSTRAJ_SLEEP || 3000;
var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


var daemon = function() {
	database.read("/fnstraj-queue/", function( results, error ) {
		if (( typeof error !== "undefined" && error ) || results.total_rows === 0 ) {
			///////////////////////////////////////////////
			// CASE: No results || No Connection - SLEEP //
			///////////////////////////////////////////////

			sleep();
		} else {
			//////////////////////////////////////////////////////
			// CASE: Queue found - Add to local queue - FORWARD //
			//////////////////////////////////////////////////////
			var queue = async.queue( function( task, callback ) {
				var id = task.id;
				var flight = task.doc;

				if ( flight.parameters.flags.active ) {
					//////////////////////////////////////////////
					// CASE: Queue item currently active - PASS //
					//////////////////////////////////////////////

					callback();
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
									database.remove('/fnstraj-queue/' + id);

									// Notify user to power on their SPOT.

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
												console.log("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m \x1B[43;30m spot \x1B[0m");
												
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

															console.log("Complete: flight #" + flight.parameters.options.flightID);
														}

														callback();
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

														console.log("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m \x1B[43;30m spot \x1B[0m" + overrideMessage);

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
																	console.log("Complete: flight #" + flight.parameters.options.flightID);
																	
																	if ( flight.parameters.meta.email !== "" ) {
																		emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + id + "\n\nThanks for experimenting with us,\n-fnstraj";

																		helpers.sendMail( flight.parameters.meta.email, "fnstraj prediction: flight #" + id, emailContent );
																	}
																}

																callback();
															});
														});
													} else {
														/////////////////////////////////////////
														// CASE: NO NEW TRACKING POINTS - PASS //
														/////////////////////////////////////////
														database.write('/fnstraj-queue/' + id, { parameters: flight.parameters }, function( error ) {
															callback();
														});
													}
												} else {
													console.log("Spot Livetrack Done");

													database.remove('/fnstraj-queue/' + id);

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
							console.log("Predicting: flight #" + flight.parameters.options.flightID + " \x1B[47;30m " + flight.parameters.options.model  + " \x1B[0m");
							
							fnstraj.predict( flight.parameters, false, function( error ) {
								if ( typeof error !== "undefined" && error ) {
									/////////////////////////////
									// Prediction Failed Email //
									/////////////////////////////
									if ( flight.parameters.meta.email !== "" ) {
										emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

										helpers.sendMail( flight.parameters.meta.email, "fnstraj failed: flight #" + id, emailContent );
									}
								} else {
									/////////////////////////////////
									// Prediction Completion Email //
									/////////////////////////////////
									console.log("Complete: flight #" + flight.parameters.options.flightID);
									
									if ( flight.parameters.meta.email !== "" ) {
										emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + id + "\n\nThanks for experimenting with us,\n-fnstraj";

										helpers.sendMail( flight.parameters.meta.email, "fnstraj prediction: flight #" + id, emailContent );
									}
								}

								database.remove('/fnstraj-queue/' + id);

								callback();
							});
						}
					});
				}
			}, 1);

			queue.push( results.rows );

			queue.drain = function() {
				sleep();
			}
		}
	});
}


///////////////////////
// LOCK-SAFE ADVANCE //
///////////////////////
function advance() {
	setImmediate(function() {
		daemon();
	});
}


/////////////////////
// LOCK-SAFE SLEEP //
/////////////////////
function sleep() {
	setImmediate(function() {
		setTimeout(function() {
			daemon();
		}, fnstraj_sleep);
	})
}


////////////////////////////////
// INITIALIZE AND RUN FNSTRAJ //
////////////////////////////////
(function() {
	//////////////////////////////////////////////
	// Database Configuration and Status Checks //
	//////////////////////////////////////////////
	console.log("\x1B[47;30m fnstraj backend, v." + meta.version + " \x1B[0m");

	if (
		typeof process.env.COUCHDB_HOST === "undefined" ||
		typeof process.env.COUCHDB_PORT === "undefined" ||
		typeof process.env.COUCHDB_USER === "undefined" ||
		typeof process.env.COUCHDB_PASS === "undefined"
	) {
		console.log("Database configuration unavailable! RTFM! ...dies...");
	} else {

		if ( typeof process.env.FNSTRAJ_SLEEP === "undefined" ) {
			console.log("FNSTRAJ_SLEEP was undefined, defaulting to 3 seconds.");
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
})();