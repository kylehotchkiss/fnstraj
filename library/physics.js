/**
 *
 * fnstraj | Physics Functions
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 * physics.density - get the density (kg/cu m^2) for altitude
 *
 */

exports.density = function( altitude ) {
    var baseAlt, stdPressure, stdTemperature, tempLapse,
        temperature, pressure, pressBase, pressExp;



    //////////////////////////
    // ISA Level Assignment //
    //////////////////////////
    if ( altitude < 11019 ) {
        baseAlt			= 0;
        stdPressure		= 101325;
        stdTemperature	= 288.15;
        tempLapse		= -0.0065;
    } else if ( altitude >= 11019 && altitude < 20063 ) {
        baseAlt			= 11019;
        stdPressure		= 22632;
        stdTemperature	= 216.65;
        tempLapse		= 0;
    } else if ( altitude >= 20063 && altitude < 32162 ) {
        baseAlt			= 20063;
        stdPressure		= 5474.9;
        stdTemperature	= 216.65;
        tempLapse		= 0.001;
    } else if ( altitude >= 32162 && altitude < 47350 ) {
        baseAlt			= 32162;
        stdPressure		= 868.02;
        stdTemperature	= 228.65;
        tempLapse		= 0.0028;
    }



    //////////////////////////////////
    // Density Altitude Calculation //
    //////////////////////////////////
    temperature = stdTemperature - tempLapse * (altitude - baseAlt);

    if ( tempLapse === 0 ) {
        pressure 	= 101325 * Math.exp( -( altitude * 9.80665 * 0.0289644 ) / ( temperature * 8.31447 ) );
    } else {
        pressBase 	=  1 - ((tempLapse * altitude) / (temperature));
        pressExp	= ( 9.80665 * 0.0289644 ) / ( 8.31447 * tempLapse );
        pressure 	= 101325 * Math.pow(pressBase, pressExp);
    }

    return ( pressure * 0.0289644 ) / ( 8.31447 * temperature );
}