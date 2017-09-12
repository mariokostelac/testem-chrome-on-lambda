const { resolve } = require('path')
const { spawn } = require('child_process')
const got = require('got')
const CDP = require('chrome-remote-interface')
const { waitUntilResolves } = require('./utils')
const { Timer } = require('./timer')

const defaultChromeFlags = [
  '--no-default-browser-check',
  '--no-first-run',
  '--ignore-certificate-errors',
  '--test-type',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',

  '--user-data-dir=/tmp/user-data',
  '--data-path=/tmp/data-path',
  '--disk-cache-dir=/tmp/cache-dir',
  '--homedir=/tmp',
  '--remote-debugging-port=9222',

  '--headless',
  '--disable-gpu',
  '--window-size=1280x1696',
  '--no-sandbox',
  '--hide-scrollbars',
  '--enable-logging',
  '--log-level=0',
  '--v=99',
  '--single-process',
]

function logInfo(data) {
  console.log(data.toString())
}

function logError(data) {
  console.error(data.toString())
}

function resolveChromePath() {
  if (process.platform === 'darwin')  {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else {
    return resolve('bin/headless_shell')
  }
}

function waitUntilChromeReady(timeout) {
  return waitUntilResolves(() => {
    return got(`localhost:9222/json`, { retries: 0, timeout: 100 })
  }, timeout)
}

function waitForTestemEvent(event, timeout, DOM, Console) {
  return new Promise(function(fullfill, reject) {
    const cancelId = setTimeout(async function() {
      const documentNode = await DOM.getDocument()
      if (documentNode.root.nodeId === 0) {
        reject('Document node is not available yet')
      }

      const bodyNodeId = await DOM.querySelector({ nodeId: documentNode.root.nodeId, selector: 'body' })
      const { outerHTML } = await DOM.getOuterHTML(bodyNodeId)
      reject(`Body HTML: ${outerHTML}`)
    }, timeout)

    Console.messageAdded(function(msgWrapper) {
      const message = msgWrapper.message
      if (message.text === event) {
        clearTimeout(cancelId)
        fullfill()
      }
    })
  })
};

function launch(options = {}) {
  const timeout = options['timeout'] || 10000;
  const chromeArgs = options['chromeArgs'] || defaultChromeFlags;
  return new Promise(async function(fullfill, reject) {
      const chrome = spawn(resolveChromePath(), chromeArgs)
      const noOp = function() {}
      process.on('exit', () => { chrome.kill() })

      // Not sure why, but not consuming these messages makes the process halt.
      chrome.stdout.on('data', noOp);
      chrome.stderr.on('data', noOp);

      chrome.on('close', (code) => {
        globalTimer.report(`Chrome exited with ${code}`)
      });
    
      try {
        await waitUntilChromeReady(timeout)
        fullfill(chrome);
      } catch(err) {
        reject(err)
      }
  });
}

async function cdp() {
  const [tab] = await CDP.List()
  const client = await CDP({ host: '127.0.0.1', target: tab })
  const { Page, DOM, Runtime, Console } = client

  return new Promise(async function(fullfill, reject) {
    try {
      await Promise.all([
        Page.enable(),
        DOM.enable(),
        Runtime.enable(),
        Console.enable(),
      ])

      fullfill({ Page, DOM, Runtime, Console })
    } catch (err) {
      reject(err)
    }
  });
}

async function sleep(durationMs) {
  return new Promise(function(fullfill, _) {
    setTimeout(fullfill, durationMs)
  });
}

var run = async function(event, context, callback) {
  globalTimer.reset()
  const testsStartTimeoutMs = parseInt(process.env["TESTS_START_TIMEOUT_MS"]) || 60000;
  const testsRunTimeoutMs = parseInt(process.env["TESTS_RUN_TIMEOUT_MS"]) || 300000;
  let chrome = null;
  try {
    let url = 'https://www.google.com'
    if (typeof(event) === 'object' && event['url']) {
      url = event['url']
    } else if (typeof(event) === 'string' && event.length > 0) {
      url = event
    }

    chrome = await launch()
    globalTimer.report(`Chrome launched with PID ${chrome.pid}`)

    const { Page, DOM, Runtime, Console } = await cdp()

    Console.messageAdded(function(msgWrapper) {
      if (!msgWrapper.message.text.startsWith("testem-client:")) {
        return
      }
      globalTimer.report(msgWrapper.message.text)
    })

    Runtime.executionContextCreated(async function() {
      const { result, exceptionDetails } = await Runtime.evaluate({ expression: "typeof(window.Testem.emit) === 'function'", returnByValue: true })
      if (result.value === true) {
        console.log("Testem is loaded. Patching emitMessage method!")
        const patchEmitMessage = function() {
          Testem.originalEmitMessage = Testem.emitMessage
          Testem.emitMessage = function() {
            this.originalEmitMessage.apply(this, arguments)
            this.console.log(`testem-client:${arguments[0]}`)
          }
        }
        const patchScript = `(${patchEmitMessage.toString()})()`
        const { exceptionDetails } = await Runtime.evaluate({ expression: patchScript })
        if (typeof(exceptionDetails) !== 'undefined') {
          console.error("Error while patching emitMessage", exceptionDetails)
        }

        console.log("Patching emitMessage successful!")
      }
    })

    await Page.navigate({ url: url })
    globalTimer.report(`Navigated to ${url}`)

    await waitForTestemEvent('testem-client:tests-start', testsStartTimeoutMs, DOM, Console)
    await waitForTestemEvent('testem-client:all-test-results', testsRunTimeoutMs, DOM, Console)

    // make sure browser runner has time to process the last event
    await sleep(1000)

    callback(null, 'ok')
  } catch(err) {
    console.error(err)
    callback(err, null)
  }

  if (chrome !== null) {
    chrome.kill()
  }
};

let globalTimer = new Timer(console.log)

module.exports.run = run;
