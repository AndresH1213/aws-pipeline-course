const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const canary = async function () {
  await synthetics.executeHttpStep(
    'Verify API return succesful response',
    process.env.API_ENDPOINT
  );
  log('http executed...');
};

exports.handler = async () => {
  return await canary();
};
