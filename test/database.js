/**
 *
 * fnstraj | Mocha Tests (for Library)
 * Copyright 2011-2013 Kyle Hotchkiss
 * Released under the GPL
 *
 */

 
var assert = require("assert");
var database = require("../library/database.js");


describe("Database", function() {
    
    describe("Initialization", function() {
        it("Check Database Variables", function() {            
            assert.strictEqual(typeof process.env.COUCHDB_HOST, undefined);
            assert.strictEqual(typeof process.env.COUCHDB_PORT, undefined);
            assert.strictEqual(typeof process.env.COUCHDB_USER, undefined);
            assert.strictEqual(typeof process.env.COUCHDB_PASS, undefined);
        });
    });


    describe(".read()", function() {
        it("Read a single entry", function( done ) {
            database.read("/fnstraj-flights/1361639151", function( results, error ) {
                if ( typeof error !== "undefined" && error ) {
                    throw error;
                } else {
                    results.should.be.a('object');
                    
                    if ( results.error ) {
                        throw error;
                    } else {
                        done();   
                    }
                }
            });
        });
        
        
        it("Read an index page", function( done ) {
            database.read("/fnstraj-flights/", function( results, error ) {
                if ( typeof error !== "undefined" && error ) {
                    throw error;
                } else {
                    results.should.be.a('object');
                    
                    if ( results.error ) {
                        throw error;
                    } else {
                        done();   
                    }
                }
            });
        });
        
        
        it("Return an error when requesting improper URL", function( done ) {
            database.read("/fnstraj-flights/fakeflight", function( results, error ) {
                if ( typeof error !== "undefined" && error ) {
                    done();
                } else {
                    throw error;
                }
             }); 
        });
        
    });
});