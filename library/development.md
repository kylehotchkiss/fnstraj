## fnstraj :: Library :: Development Notes

* Thirdparty scripts are loaded before any of these library scripts are. They are available for use here.
* Let's just not do globals. Attach every function to a parent object of the same name as the file. Define every var with var.
* Async.js all the things! Seriously. Don't forget why you ditched the Node.js version. Callback hell.
* 