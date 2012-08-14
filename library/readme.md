# fnstraj :: Library

This is the actual trajectory prediction code. This was the majority of the challenges to the project at first. Now they are much easier to grasp. I think I have them organized in a way that will help you understand what is going on. 

### grads.js
When you're trying to understand where a balloon is flying, it's probably in your best interest to understand what direction it is going. This is how that happens. Basically, it takes the 4D (longitude, latitude, altitude, time) coordinates and gives you the speed and heading that the wind **should be** heading (they are still predictions, there is no such thing as high altitude anemometers). 

fnstraj is remarkably different than other predictors in that it allows the user to choose between one of three wind models to get data from. This was an easy feature to implement and it helps users achieve much more impressive results. It does require a bit of logic to determine which model would be best for their flight, however.

There are some notable glitches with NOAA GrADS you **probably** need to be aware of. The first is time. All of the weather information is in Zulu time, but has proven to be an hour or two behind in many cases for me (on RAP). My understanding of high altitude winds tells me that two hours difference will not harm a predictor, as the jet stream is not known to change multitudes of latitude within hours times. GrADS also likes to just... break sometimes. No logicial reason, it just doesn't return anything but a nondescript error message. Any application build on GrADS should anticipate and expect this behavior. One word: requeue.

### helpers.js
This one just hooks up with several different APIs to provide higher quality metadata on various things. Like Google's geolocation API to give users named locations, instead of coordinates.

### physics.js
This one is the one that probably needs some peer review. It just contains all the physics related functions. They're mostly just forms of the standard drag formula. They get ran several hundred times and you have a trajectory. Tada!

### position.js 
Ugh. Anything dealing with converting coordinates to more practical units of distance. Hope you know when to use a great-circle distance and when to use spherical law of cosines. This may be the biggest bottleneck to accuracy, I need to research that, however.