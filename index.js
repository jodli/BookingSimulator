const puppeteer = require('puppeteer');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const log = require('loglevel');
const program = require('commander');

require('dotenv').config();
require('require-environment-variables')(['BASE_URL', 'PROJECTS_URL', 'AUTH_USER', 'AUTH_PASS']);

async function getProjects(outFile, options) {
	const projektSelector = '#ctl00_cphContent_cboProjects_DDD_L_LBT > tbody > tr';
	const projektInputSelector = '#ctl00_cphContent_cboProjects_I';
	const ladeElementSelector = '#ctl00_cphContent_cboProjects_LPV';
	const erfassungSelector = '#ctl00_cphContent_cboPSItem_0_DDD_L_LBT > tbody > tr';

	log.trace('Setting up csv writer.');
	const writer = csvWriter({
		sendHeaders: true,
		separator: ';'
	});
	writer.pipe(fs.createWriteStream(outFile));
	
	log.trace('Setting up browser.');
	const browser = await puppeteer.launch({
		headless: !options.interactiveMode,
		timeout: 60000,
		userDataDir: options.userDataDir,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});
	const page = await browser.newPage();
	await page.setViewport({
		width: 1024,
		height: 786
	});

	log.trace('Navigate to mportal');
	page.goto(process.env.BASE_URL, {
		waitUntil: 'domcontentloaded'
	});

	await page.waitFor(5000);
	
	const responseAuth = await page.authenticate({
		username:process.env.AUTH_USER,
		password:process.env.AUTH_PASS
	});

	log.trace('Navigate to project times');
	await page.goto(process.env.BASE_URL + process.env.PROJECTS_URL, {
		waitUntil: 'domcontentloaded'
	});

	log.trace('Getting available projects');
	const projects = await page.evaluate((selector) => {
		var tds = Array.from(document.querySelectorAll(selector));
		return tds.map(td => td.textContent.trim());
	}, projektSelector);
	log.info(projects);

	for (var i = 0, len = projects.length; i < len; i++) {
		await page.waitFor(2000);
		log.trace('Selecting project ' + i + ' of ' + len);

		log.trace('Focusing project input field');
		const projectInput = await page.$(projektInputSelector);
		projectInput.focus();

		log.trace('Selecting all text');
		await page.keyboard.down('Control');
		await page.keyboard.down('A');

		await page.keyboard.up('A');
		await page.keyboard.up('Control');

		log.trace('Typing project name: ' + projects[i]);
		projectInput.type(projects[i]);

		log.trace('Waiting for loading elements to be added');
		await page.waitForSelector(ladeElementSelector, {
			visible: true
		});

		log.trace('Waiting for loading elements to be removed');
		await page.waitForSelector(ladeElementSelector, {
			hidden: true
		});

		log.trace('Selecting project');
		await projectInput.press('Enter');

		log.trace('Waiting for navigation');
		await page.waitForNavigation({
			waitUntil: 'domcontentloaded'
		});

		log.trace('Getting available registrations for this project');
		const registrations = await page.evaluate((selector) => {
			var tds = Array.from(document.querySelectorAll(selector));
			return tds.map(td => td.textContent.trim());
		}, erfassungSelector);
		log.info(registrations);

		log.trace('Writing data to csv');
		writer.write({Project: projects[i], Registrations: registrations});
	}

	log.info('Done.');
	writer.end();
	log.trace('Closed csv stream.');
	browser.close();
	log.trace('Closed browser.');
}

async function bookProjects(inFile) {

}

log.setLevel('warn');
program	.version('0.0.1');

program
	.command('getProjects <path>')
	.description('Gets all projects and its registrations and writes them in .csv format to <path>.')
	.option('-v, --verbose', 'Enables verbose logging.')
	.option('-t, --trace', 'Enables trace logging.')
	.option('-i, --interactive-mode', 'Shows the browser window.')
	.option('-u, --user-data-dir <userDataDir>', 'Specifies the user data dir for the chromium.')
	.action(function (path, options) {
		if (options.verbose) {
			log.setLevel('info');
			log.info('Enabled verbose logging.');
		}
		if (options.trace) {
			log.enableAll();
			log.trace('Enabled trace logging.');
		}
		if (options.interactiveMode) {
			log.trace('Running the browser in interactive mode.');
		}
		if (options.userDataDir) {
			log.trace('UserDataDir is: ' + options.userDataDir);
		}
		log.info('Getting projects and their registrations');
		log.info('and writing them to: ' + path);
		getProjects(path, options);
	});

program.parse(process.argv);