'use strict';

const { resolve } = require('path')
const { spawn } = require('child_process')
const got = require('got')
const CDP = require('chrome-remote-interface')
const { waitUntilResolves } = require('../utils')

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

function waitUntilTestsFinish(DOM, timeout) {
  return waitUntilResolves(async () => {
    const documentNode = await DOM.getDocument()
    const resultBoxNode = await DOM.querySelector({ nodeId: documentNode.root.nodeId, selector: '#qunit-testresult-display' })
    const { outerHTML } = await DOM.getOuterHTML({ nodeId: resultBoxNode.nodeId })
    const isFinished = outerHTML.match(/Tests completed in/)
    if (!isFinished) {
      throw `Tests haven't finished yet`
    }
    return outerHTML;
  }, timeout)
};

function launch(options = {}) {
  const timeout = options['timeout'] || 10000;
  const chromeArgs = options['chromeArgs'] || defaultChromeFlags;
  return new Promise(async function(fullfill, reject) {
      const chrome = spawn(resolveChromePath(), chromeArgs)
      process.on('exit', () => { chrome.kill() })
      chrome.stdout.on('data', logInfo);
      //chrome.stderr.on('data', logError);
      chrome.on('close', (code) => {
        console.log(`chrome process exited with code ${code}`);
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
  const { Page, DOM } = client

  return new Promise(async function(fullfill, reject) {
    try {
      await Promise.all([
        Page.enable(),
        DOM.enable(),
      ])
  
      fullfill({ Page, DOM })
    } catch (err) {
      reject(err)
    }
  });
}

var run = async function(event, context, callback) {
  let url = 'https://www.google.com'
  if (typeof(event) === 'object' && event['url']) {
    url = event['url']
  } else if (typeof(event) === 'string' && event.length > 0) {
    url = event
  }  

  const chrome = await launch()
  const { Page, DOM } = await cdp()
  await Page.navigate({ url: url })
  console.log(`Navigated to ${url}`)

  const result = await waitUntilTestsFinish(DOM, 30000)
  chrome.kill();
  callback(null, result);
};

module.exports = run;
