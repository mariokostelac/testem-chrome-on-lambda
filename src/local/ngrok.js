const fs = require('fs')
const got = require('got')
const { exec, execSync, spawn } = require('child_process')

let pidFileForPort = function(port) {
    return `/tmp/testem_ngrok_port_${port}.pid`
}

let isExecPresent = function(programName) {
    return new Promise(function(fullfill, reject) {
        let cmd = exec(`which ${programName}`)
        cmd.on('exit', function(code) {
            fullfill(code === 0)
        })
    })
}

let isInstalled = async function() {
    return await isExecPresent('ngrok')
}

let ps = function(pid) {
    return execSync(`ps -p ${pid}`)
}

let isNgrokProcessStillAlive = function(pid) {
    try {
        return ps(pid).toString().match(/ngrok/)
    } catch(err) {
        return false
    }
}

// NOTE: this function is pretty racy
let ensureProxyIsRunning = async function(port) {
    const pidFile = pidFileForPort(port)
    if (fs.existsSync(pidFile)) {
        const existingPid = +(fs.readFileSync(pidFile).toString())
        if (isNgrokProcessStillAlive(existingPid)) {
            return
        }

        // clean the pid file so the new process can start
        fs.unlinkSync(pidFile)
    }

    // make sure just one process can create a file for specific port
    const flags = fs.constants.O_EXCL | fs.constants.O_CREAT | fs.constants.O_WRONLY;
    const pidFd = fs.openSync(pidFile, flags)
    const process = spawn('ngrok', ['http', port], { detached: true })
    fs.writeSync(pidFd, process.pid)
    fs.closeSync(pidFd)

    return
}

module.exports = {
    isInstalled: isInstalled,
    ensureProxyIsRunning: ensureProxyIsRunning,
}
