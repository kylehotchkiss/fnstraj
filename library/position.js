/**
 *
 * fnstraj | Position Functions
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * position.travel   - Travel from point, get new coordinates.
 * position.distance - Distance, in Metres, between two points.
 * position.heading  - Heading from coordinates.
 * position.midpoint - Get the coordinates between two points.
 * position.ascend   - Ascend, given ballon information.
 * position.descend  - Descend, given parachute information.
 *
 */
var physics = require('./physics.js');

var RADIANS = Math.PI / 180;
var DEGREES = 180 / Math.PI;
var GRAVITY = 9.80665;


exports.travel = function( frame, distance, heading ) {
    //////////////////////////////////////////////////////
    // Take a set of coordinates, distance, and heading //
    // return new coordinates. May be sloppy interface? //
    //////////////////////////////////////////////////////
    radius   = (6367500 + frame.altitude) * RADIANS;
    oldLat   = frame.latitude * RADIANS;
    oldLon   = frame.longitude * RADIANS;
    distance = distance * RADIANS;
    heading  = heading * RADIANS;

    var newLat = Math.asin( Math.sin( oldLat ) * Math.cos( distance / radius ) + Math.cos( oldLat ) * Math.sin( distance / radius ) * Math.cos( heading ) );
    var newLon = oldLon + Math.atan2( Math.sin( heading ) * Math.sin( distance / radius ) * Math.cos( oldLat ), Math.cos( distance / radius ) - Math.sin( oldLat ) * Math.sin( newLat ) );

    var latitude  = newLat * DEGREES;
    var longitude = newLon * DEGREES;

    return [latitude, longitude];
};


exports.distance = function( startLat, startLon, endLat, endLon ) {
    /////////////////////////////////////////////////////////////////
    // Distance between two points, Returns distance in Kilometers //
    /////////////////////////////////////////////////////////////////
    var distanceLat = ( endLat - startLat ) * RADIANS;
    var distanceLon	= ( endLon - startLon ) * RADIANS;
    var lat1		= startLat * RADIANS;
    var lat2		= endLat * RADIANS;

    var step1 = Math.sin(distanceLat/2) * Math.sin(distanceLat/2) + Math.sin(distanceLon/2) * Math.sin(distanceLon/2) * Math.cos(lat1) * Math.cos(lat2);
    var step2 = 2 * Math.atan2(Math.sqrt(step1), Math.sqrt(1-step1));

    return 6367 * step2;
};


exports.heading = function( startLat, startLon, endLat, endLon ) {
    ///////////////////////////////////////
    // Final Bearing from Start Location //
    ///////////////////////////////////////
    var distanceLat = ( endLat - startLat ) * RADIANS;
    var distanceLon	= ( endLon - startLon ) * RADIANS;
    var lat1		= startLat * RADIANS;
    var lat2		= endLat * RADIANS;

    var y = Math.sin(distanceLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(distanceLon);

    return Math.atan2(y, x) * DEGREES;
};


exports.midpoint = function( startLat, startLon, endLat, endLon ) {
    var distanceLon	= ( endLon - startLon ) * RADIANS;

    startLat = startLat * RADIANS;
    startLon = startLon * RADIANS;
    endLat   = endLat * RADIANS;
    endLon   = endLon * RADIANS;

    var x = Math.cos(endLat) * Math.cos(distanceLon);
    var y = Math.cos(endLat) * Math.sin(distanceLon);

    var latitude  = (Math.atan2( Math.sin(startLat) + Math.sin(endLat), Math.sqrt( (Math.cos(startLat) + x) * (Math.cos(startLat) + x) + (y * y)))) * DEGREES;
    var longitude = ( startLon + Math.atan2( y, Math.cos(startLat) + x )) * DEGREES;

    return { latitude: latitude, longitude: longitude };
};


exports.ascend = function( currAlt, burstAlt, lift, radius ) {
    //
    // Altitude: Metres
    // Lift: Kilograms
    // Radius: Metres (?)
    //
    // *needs to account for balloon radius expansion*
    // Ascent rate should be near-constant (or mentally average-able)
    // when this is properly accounted for
    //
    return Math.sqrt(( lift / 1000 ) * GRAVITY / (.5 * .3 * physics.density(currAlt) * ((( radius * radius ) * Math.PI ) / 10000 )));
};


exports.descend = function( currAlt, weight, radius ) {
    //
    // Correct me :)
    //
    return descent = Math.sqrt(( weight / 1000 ) * GRAVITY / (.5 * .75 * physics.density( currAlt ) * (( 2 * Math.PI * radius ^ 2 ))));
};