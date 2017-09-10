function waitUntilResolves(fn, timeout, options = {}) {
    const pollIntervalMs = options['pollIntervalMs'] || 100;
    if (typeof(timeout) === 'undefined') {
        throw `Timeout has to be defined.`
    }

    const startTime = new Date();
    return new Promise(function(fullfill, reject) {
        let nextPoll = async function() {
            try {
                let result = await fn()
                fullfill(result)
                return
            } catch(err) {
                const now = new Date();
                if (now - startTime > timeout) {
                    reject(`Timeout of ${timeout}ms exceeded. Last error: ${err}`)
                    return
                }

                setTimeout(nextPoll, pollIntervalMs)
            }
        }

        nextPoll()
    });
}

module.exports = {
    waitUntilResolves: waitUntilResolves,
}