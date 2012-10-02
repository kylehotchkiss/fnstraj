# fnstraj :: Library

This is the actual trajectory prediction code. This was the majority of the challenges to the project at first. Now they are much easier to grasp. I think I have them organized in a way that will help you understand what is going on. 

### fnstraj.js
This is the primary trajectory predictor loop and logic flow for a normal, start-to-finish trajectory. It's a complex beast to understand, as it is written in async.js (which is a refreshing fix from hard-coding all that asynchronously). You'll need to read through the comments to see what each block is doing here. Being the logic flow controller, this is also where everything else that is happening is called from. 

The most important data here are `flight` and `table`. `flight` contains all the information about the launch, flight, balloon, and parachute, amounst some runtime variables. `table` contains the actual flight path and is directly used for all of the outputs. 

Oh yeah, there is also a vertical predictor here. That is really only used for timers in the interface, it's a basic trajectory loop that just handles vertical ascents and descents the same way the actual trajectory program does. Don't mind it too much.

### grads.js
When you are trying to understand where a balloon is flying, it is probably in your best interest to know what direction the wind is going. These functions are how that happens. It takes the 4D coordinates (longitude, latitude, altitude, time) and returns the speed and heading that the wind **should be** heading (they are still predictions, there is no such thing as high altitude anemometers). 

fnstraj is remarkably different than other predictors in that it allows the user to choose between one of three wind models to get data from. This was an easy feature to implement and it helps users achieve much more impressive results. It does require some logic to determine which model would be best for their flight.

There are some notable glitches with NOAA GrADS you *probably* need to be aware of. The first is time. All of the weather information is in Zulu time, but has proven to be an hour or two behind in many cases for me (on RAP). My understanding of high altitude winds tells me that two hours difference will not harm a predictor, as the jet stream is not known to change multitudes of latitude within hours time. GrADS also likes to just break sometimes. There is no logical reason, it just does not return anything but a nondescript error message. Any application build on GrADS should anticipate and expect this behavior. One word: requeue.

### helpers.js
These functions connect with several different APIs to provide higher quality metadata on various predection aspects. For example, Google's geolocation API gives users named locations, instead of coordinates.

### output.js
This is an awesome file, because it allows us to easily output trajectories in pretty much any format we could desire, including databases. It's very modular, just create an output function with the parameters `table` and `callback` and then throw that function up in the `async.parallel` section up above. Yes, all outputs happen in parallel! Pretty awesome.

### physics.js
This one is the one that probably needs some peer review. It just contains all the physics related functions. They're mostly just forms of the standard drag formula. They get ran several hundred times and you have a trajectory. Tada!

### position.js 
Ugh. Anything dealing with converting coordinates to more practical units of distance. Hope you know when to use a great-circle distance and when to use spherical law of cosines. This may be the biggest bottleneck to accuracy, I need to research that, however.