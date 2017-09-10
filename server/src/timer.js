function Timer(reportingFn) {
    this.reset()
    this.reportingFn = reportingFn;
    return this
}

Timer.prototype.reset = function() {
    this.startTime = new Date();
}

Timer.prototype.elapsedMs = function() {
    return (new Date()) - this.startTime;
}

Timer.prototype.report = function(pointName) {
    this.reportingFn(`${pointName}: ${this.elapsedMs()}ms`)
}

module.exports = {
    Timer: Timer,
}