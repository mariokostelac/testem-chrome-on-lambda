# testem-chrome-on-lambda
Super experimenal project of testing EmberJS on AWS Lambda.

## Why ?
As app grows, more and more tests are added. Splitting tests into concurrent containers is a very simple and effective technique, but it gets expensive over time and it has its own limits. Traditional CI providers can't offer really high number of parallel containers. Also, they charge you as if you utilized your containers 100% of the time.

## Installation
### Integrate your project with [ember-exam](https://github.com/trentmwillis/ember-exam)
Follow [ember-exam instructions](https://github.com/trentmwillis/ember-exam#installation) to integrate ember-exam into your project. It is used for tests spitting and is absolutely necessary here.

### Install testem-chrome-on-lambda
#### testem browser project
```bash
cd ~/src # use directory of your choice
git clone https://github.com/mariokostelac/testem-chrome-on-lambda.git
npm install
```

#### Headless Chrome (running on AWS Lambda)
1. Edit `server/serverless.yaml` to reflect your environment.
2. `cd server && serverless deploy`

### Create testem chrome-on-lambda launcher
#### Create a bash script representing chrome-on-lambda launcher
Use following template to create `chrome_on_lambda` file
```bash
#!/usr/bin/env bash
set -e

cd ~/src/testem-chrome-on-lambda/
export AWS_ACCESS_KEY_ID="AKIxxxxx"
export AWS_SECRET_ACCESS_KEY="<YOUR_AWS_SECRET_ACCESS_KY>"
npm start $@ 2>&1 | tee -a test.log
```

#### Edit testem configuration 
In case of using `testem.js`, it looks similar to:
```js
module.exports = {
  ...
  "launchers": {
    "chrome-on-lambda": {
      "command": "./chrome_on_lambda '<url>'",
      "protocol": "browser",
    }
  },
  "launch_in_ci": [
    "chrome-on-lambda"
  ],
  "launch_in_dev": [
    "chrome-on-lambda"
  ],
  ...
};

```

### Caveats
- Ember test server is open to the world. That means the only practical way of running this is having EC2 instance running `ember exam` and Lambda function inside the same VPC. If proves to be useful, secure proxy can be introduced.
- [ember-exam split resolution is module, not test](https://github.com/trentmwillis/ember-exam/issues/60). That means that partitions can be quite uneven. We do plan to fix this issue by adding support to [QUnit](https://github.com/qunitjs/qunit) or ember-exam.

#### Having an issue?
Open an issue!
