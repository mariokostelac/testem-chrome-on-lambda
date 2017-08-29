#!/usr/bin/env node
const AWS = require('aws-sdk')
const path = require('path')
const { exec } = require('child_process')
const ngrok = require('./ngrok')

const Lambda = new AWS.Lambda({ region: 'us-east-1' })
const serverlessPath = path.resolve('node_modules/serverless/bin/serverless')

let run = async function(args) {
    if (args.length === 0) {
        throw 'not enough arguments. URL to open has to be provided!'
    }

    let data = {
        url: args[0],
    }

    const dataPayload = JSON.stringify(data)
    const isNgrokInstalled = await ngrok.isInstalled()
    if (!isNgrokInstalled) {
        throw `ngrok can't be found. https://ngrok.com/download`
    }
    // TODO: extract the port from given url
    await ngrok.ensureProxyIsRunning(7357)

    // TODO: extract the port from given localhost URL
    // TODO: replace with correct URL, not this hardcoded one
    const proxiedUrl = data.url.replace('http://localhost:7357/', 'http://ac0a0f0b.ngrok.io/')

    const params = {
        FunctionName: 'chrome-on-lambda-dev-run',
        Payload: JSON.stringify({ url: proxiedUrl }),
    }
    Lambda.invoke(params, function(err, data) {
        console.error(err)
        console.log(data)
    });

    return
}

run(process.argv.slice(2)).catch(function(err) {
    console.error(err)
    process.exit(1)
})