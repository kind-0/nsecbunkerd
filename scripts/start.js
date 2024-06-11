const { execSync, spawn } = require('child_process');
const fs = require('fs');

try {
	console.log(`Running migrations`);
  // check if config folder exists
  if (!fs.existsSync('./config')) {
    execSync(`mkdir config`);
  }
  execSync('npm run prisma:migrate');
} catch (error) {
	console.log(error);
  // Handle any potential migration errors here
}

const args = process.argv.slice(2);
const childProcess = spawn('node', ['./dist/index.js', ...args], {
  stdio: 'inherit',
});

childProcess.on('exit', (code) => {
  console.log("Exiting nsecbunkerd with code " + code)
  process.exit(code);
});
