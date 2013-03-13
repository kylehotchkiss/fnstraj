/**
 *
 * fnstraj | Worker Process
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * Garbage Collection based on process.nextTick(), but if possible,
 * we want to catch stack overflows and and see what happened.
 *
 * In the future,
 *  - Move all console.logs for Worker purposes to here
 *  - Rewrite on Async.js Queue Engine, Sleep Longer
 *
 */

var async	 = require('async');
var spot     = require('./library/spot.js');
var fnstraj	 = require('./library/fnstraj.js');
var helpers	 = require('./library/helpers.js');
var database = require('./library/database.js');


var fnstraj_mode = process.env.FNSTRAJ_MODE || "development";
var fnstraj_sleep = process.env.FNSTRAJ_SLEEP || 3000;
var fnstraj_debug = process.env.FNSTRAJ_DEBUG || false;


////////////////////////////////////////
// WORKER LOOP (Optimized for Heroku) //
////////////////////////////////////////
var daemon = function() {
	database.read('/fnstraj-queue/', function( results, error ) {
		if ( typeof error !== "undefined" && error ) {
			///////////////////////////////
			// CASE: DATABASE DOWN/SLEEP //
			///////////////////////////////
			sleep();
		} else {
			var i = 0, j = 0;
			var queue = results.rows;

			if ( typeof queue === "object" && typeof queue[0] !== "undefined" ) {
				///////////////////////////////
				// CASE: QUEUE FOUND/FORWARD //
				///////////////////////////////
				while ( typeof queue[j] !== "undefined" && typeof queue[j].doc !== "undefined" ) {
					// CouchDB Object Cleanup
					queue[j].parameters = queue[j].doc.parameters;
					delete queue[j].doc;

					j++;
				}

				//////////////////////////////////////////////////////////
				// Determine if queue items are already being worked on //
				//////////////////////////////////////////////////////////
				var continueQueue = false;

				console.log(queue.length);

				if ( queue.length === 1 ) {
					if ( !queue[i].parameters.flags.active ) {
						continueQueue = true;
					}
				} else {
					while ( queue[i].parameters.flags.active ) {
						if ( i < ( queue.length - 1) ) {
							i++;
						} else {
							break;
						}
					}

					if ( !queue[i].parameters.flags.active ) {
						continueQueue = true;
					}
				}


				if ( continueQueue ) {
					////////////////////
					// INITIALIZATION //
					////////////////////
					var queuedID = queue[i].parameters.options.id || queue[i].id;
					var queuedFlight = queue[i];
					var now = new Date();
					var timestamp = now.getTime();


					/////////////////////
					// OPTIONS PARSING //
					/////////////////////
					if ( typeof queuedFlight.parameters.flags.spot !== "undefined" && queuedFlight.parameters.flags.spot ) {
						// This isn't an option that would be forwarded from the queue. Consider removing/Depricate
						useSpot = queuedFlight.parameters.flags.spot;
					} else {
						useSpot = false;
					}


					/////////////////////////////////
					// FLIGHT OBJECT ESTABLISHMENT //
					/////////////////////////////////
					var flight = {
						flags: {
							spot: useSpot,
							active: true,
							lastActivity: false
						}, meta: {
							name: queuedFlight.parameters.meta.name,
							email: queuedFlight.parameters.meta.email,
							program: queuedFlight.parameters.meta.program
						}, options: {
							model: queuedFlight.parameters.options.model,
							context: "daemon",
							flightID: queuedID,

							// Optional
							resolution: 1
						}, launch: {
							altitude: parseFloat(queuedFlight.parameters.launch.altitude),
							latitude: parseFloat(queuedFlight.parameters.launch.latitude),
							longitude: parseFloat(queuedFlight.parameters.launch.longitude),
							timestamp: timestamp
						}, balloon: {
							lift: parseFloat(queuedFlight.parameters.balloon.lift),
							burst: parseFloat(queuedFlight.parameters.balloon.burst),
							burstRadius: parseFloat(queuedFlight.parameters.balloon.burstRadius),
							launchRadius: parseFloat(queuedFlight.parameters.balloon.launchRadius)
						}, payload: {
							weight:	parseFloat(queuedFlight.parameters.payload.weight),
							chuteRadius: parseFloat(queuedFlight.parameters.payload.chuteRadius),
						}
					};


					/////////////////////////////////
					// Set our ACTIVE flag to TRUE //
					/////////////////////////////////
					database.write('/fnstraj-queue/' + queuedID, { parameters: flight }, function( error ) {
						flight.flags.active = false;

						if ( queuedFlight.parameters.flags.spot ) {
							//////////////////////////////////////////
							// SPOT Tracking / Live Trajectory Mode //
							//////////////////////////////////////////
							console.log("Livetrack: Spot " + queuedFlight.parameters.flags.spot);

							spot.getTracking( queuedFlight.parameters.flags.spot, function( tracking, error ) {
								if ( typeof error !== "undefined" && error ) {
									//////////////////////////////////////
									// CASE: POINTS UNAVAILABLE/FORWARD //
									//////////////////////////////////////
									database.remove('/fnstraj-queue/' + queuedID);

									// Notify user to power on their SPOT.

									advance();
								} else {
									////////////////////////////////////////
									// CASE: TRACKING DATA EXISTS/FORWARD //
									////////////////////////////////////////
									database.read('/fnstraj-flights/' + queuedID, function( prevFlight, prevError ) {
										if ( typeof error !== "undefined" && error ) {
											///////////////////////////////
											// CASE: DATABASE DOWN/SLEEP //
											///////////////////////////////
											sleep();
										} else {
											if ( typeof prevError !== "undefined" && prevError ) {
												///////////////////////////////////////////
												// Run First Prediction of SPOT Tracking //
												///////////////////////////////////////////
												fnstraj.predict( flight, false, function( predictorError ) {
													database.write('/fnstraj-queue/' + queuedID, { parameters: flight }, function( error ) {
														if ( typeof predictorError !== "undefined" && predictorError ) {
															/////////////////////////////////////
															// CASE: PREDICTION FAILED/FORWARD //
															/////////////////////////////////////


														} else {
															////////////////////////////
															// CASE: COMPLETE/FORWARD //
															////////////////////////////

														}

														advance();
													});
												});

											} else {
												///////////////////////////////////////
												// Run From Last SPOT Tracking Point //
												///////////////////////////////////////
												var repredict = spot.processTracking( tracking, prevFlight );

												if ( flight.launch.timestamp < ( prevFlight.parameters.launch.timestamp + ( prevFlight.prediction[0].length * 1000 * 60 )) ) {
													if ( repredict ) {
														//////////////////////////////////////////
														// CASE: REPREDICT FROM LAST SPOT POINT //
														//////////////////////////////////////////
														prevFlight.parameters.options.launchOffset = repredict;
														//prevFlight.parameters.launch.timestamp

														if ( spot.determineOverride( tracking, prevFlight ) ) {
															prevFlight.parameters.options.overrideClimb = true;
														}


														prevFlight.parameters.launch.latitude  = prevFlight.flightpath[repredict].latitude;
														prevFlight.parameters.launch.longitude = prevFlight.flightpath[repredict].longitude;
														prevFlight.parameters.launch.altitude  = prevFlight.prediction[0][repredict].altitude;


														fnstraj.predict( prevFlight.parameters, prevFlight.flightpath, function( predictorError ) {
															database.write('/fnstraj-queue/' + queuedID, { parameters: flight }, function( error ) {
																if ( typeof predictorError !== "undefined" && predictorError ) {
																	/////////////////////////////
																	// Prediction Failed Email //
																	/////////////////////////////
																	if ( queuedFlight.parameters.meta.email !== "" ) {
																		emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

																		helpers.sendMail( queuedFlight.parameters.meta.email, "fnstraj failed: flight #" + queuedID, emailContent);
																	}
																} else {
																	/////////////////////////////////
																	// Prediction Completion Email //
																	/////////////////////////////////
																	if ( queuedFlight.parameters.meta.email !== "" ) {
																		emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + queuedID + "\n\nThanks for experimenting with us,\n-fnstraj";

																		helpers.sendMail( queuedFlight.parameters.meta.email, "fnstraj prediction: flight #" + queuedID, emailContent );
																	}
																}

																advance();
															});
														});
													} else {
														////////////////////////////////////////
														// CASE: NO NEW TRACKING POINTS/SLEEP //
														////////////////////////////////////////
														database.write('/fnstraj-queue/' + queuedID, { parameters: flight }, function( error ) {
															sleep();
														});
													}
												} else {
													console.log("Spot Livetrack Done");

													database.remove('/fnstraj-queue/' + queuedID, function() {
														advance();
													});
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
							fnstraj.predict( flight, false, function( error ) {
								if ( typeof error !== "undefined" && error ) {
									/////////////////////////////
									// Prediction Failed Email //
									/////////////////////////////
									if ( queuedFlight.parameters.meta.email !== "" ) {
										emailContent = "Hey There,\n\nWe are sad to inform you that your trajectory request did not successfully compile. fnstraj is very new software, and we still have some kinks to work out. We are unable to re-queue your flight at this time, but feel free to try again, with a different model.\n\nThanks for experimenting with us,\n- fnstraj";

										helpers.sendMail( queuedFlight.parameters.meta.email, "fnstraj failed: flight #" + queuedID, emailContent);
									}
								} else {
									/////////////////////////////////
									// Prediction Completion Email //
									/////////////////////////////////
									if ( queuedFlight.parameters.meta.email !== "" ) {
										emailContent = "Hey There,\n\nWe are happy to inform you that your trajectory request successfully compiled!\n\nYou can view it here:\n        http://fnstraj.org/view/" + queuedID + "\n\nThanks for experimenting with us,\n-fnstraj";

										helpers.sendMail( queuedFlight.parameters.meta.email, "fnstraj prediction: flight #" + queuedID, emailContent );
									}
								}

								database.remove('/fnstraj-queue/' + queuedID, function() {
									advance();
								});


							});
						}
					});
				} else {
					///////////////////////////////////////
					// CASE: QUEUE IS ALL-ACTIVE/FORWARD //
					///////////////////////////////////////
					sleep();
				}
			} else {
				//////////////////////////////
				// CASE: NO ENTRIES/FORWARD //
				//////////////////////////////
				sleep();
			}
		}
	});
}


////////////////////
// DAEMON ADVANCE //
////////////////////
var advance = function() {
	setImmediate( function() {
		daemon();
	});
};


//////////////////
// DAEMON SLEEP //
//////////////////
var sleep = function() {
	setTimeout(function() {
		setImmediate( function() {
			daemon();
		});
	}, fnstraj_sleep);
};


///////////////////////////////
// Initalization + Preflight //
///////////////////////////////
(function() {
	//////////////////////////////////////////////
	// Database Configuration and Status Checks //
	//////////////////////////////////////////////
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