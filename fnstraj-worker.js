/**
 *
 * fnstraj | Worker
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 *
 * Garbage Collection based on process.nextTick(), but if possible,
 * we want to catch stack overflows and and see what happened. 
 *
 *
 */
 
var fnstraj  = require('./library/fnstraj.js');
var database = require('./library/database.js');



////////////////////////////////////////
// WORKER LOOP (Optimized for Heroku) //
////////////////////////////////////////
var daemon = function() {
    
    
    
    

    
    /*
    
    
        # Process:
        
        1) check DB for queries (to multithread, we need to remove entries on grab)
        2) get all relevant flight data (preverified)
        3) build flight object, fnstraj.predict();
        4) on success, delete entry; on failure, log error and ???
        5) mail (or add to mail queue) the job status
        6) nextTick into next iteration
    
    */
    
    
    


    
}



///////////////////////////////////////
// SLEEP ON IDLE (Easier on Network) //
///////////////////////////////////////
var sleep = function() {
    setTimeout(function() {
        console.log("Sleeping for a few...");
        
        process.nextTick( function() {
            daemon();
        });
    }, 300000); // 5min
}